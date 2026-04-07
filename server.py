"""
Pendragon GM's Binder — Flask Server
Handles auth, sessions, role-based access, and all API endpoints.
"""

import json
import os
import shutil
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import re
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path

from flask import (Flask, jsonify, redirect, render_template_string,
                   request, send_from_directory, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

# ── PATHS ────────────────────────────────────────────────────────────────────

APP_VERSION  = '2.6.0'   # keep in sync with js/app.js
BASE_DIR     = Path(__file__).parent.resolve()
CONFIG_FILE  = BASE_DIR / 'config.json'
SECRETS_FILE = BASE_DIR / 'secrets.env'
USERS_FILE   = BASE_DIR / 'users.json'
BACKUP_DIR   = BASE_DIR / 'backups'
PLAYER_DATA_DIR  = BASE_DIR / 'player_data'
SUBMISSIONS_FILE = BASE_DIR / 'submissions.json'
CERT_FILE    = BASE_DIR / 'cert.pem'
KEY_FILE     = BASE_DIR / 'key.pem'
PORT         = 8765

# Files that must never be served to the browser
BLOCKED_FILES = {
    'secrets.env', 'users.json', 'cert.pem', 'key.pem',
    'cert.pem.bak', 'key.pem.bak',
    'config.json', '.env',
}
# Any file whose name ends with one of these suffixes is also blocked
BLOCKED_SUFFIXES = ('.pem', '.pem.bak', '.key')

# ── SECRETS ──────────────────────────────────────────────────────────────────

def load_secrets():
    secrets = {}
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                secrets[k.strip()] = v.strip()
    return secrets

SECRETS = load_secrets()

# ── APP ───────────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder=None)
app.secret_key = SECRETS.get('FLASK_SECRET') or os.urandom(32)

# Suppress werkzeug's per-request access log — it interleaves with console
# input on Windows, garbling typed commands.  Our own [Save]/[Load] prints
# are sufficient feedback.
import logging
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# Silence low-level HTTP parser noise ("code 400, message Bad request...") that
# werkzeug/BaseHTTPRequestHandler writes when a client sends TLS bytes to the
# HTTP server (e.g. a stale browser tab still pointing at https://). This is
# pure noise for our use case. We wrap sys.stderr so the filter catches every
# code path that might emit these lines, regardless of logger config.
class _StderrFilter:
    def __init__(self, wrapped):
        self._wrapped = wrapped
        self._buf = ''
    def write(self, s):
        # Filter on complete lines so we don't split a message mid-write.
        self._buf += s
        while '\n' in self._buf:
            line, self._buf = self._buf.split('\n', 1)
            low = line.lower()
            if 'bad request' in low or 'code 400' in low:
                continue  # drop
            self._wrapped.write(line + '\n')
    def flush(self):
        if self._buf:
            low = self._buf.lower()
            if 'bad request' not in low and 'code 400' not in low:
                self._wrapped.write(self._buf)
            self._buf = ''
        self._wrapped.flush()
    def __getattr__(self, name):
        return getattr(self._wrapped, name)

sys.stderr = _StderrFilter(sys.stderr)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# Secure cookies: always True behind Cloudflare Tunnel (CF_TUNNEL=1 in secrets.env)
# because clients see HTTPS even though the local leg is plain HTTP.
# Disabled under FORCE_HTTP=1 for plain-LAN use without a tunnel.
_cf_tunnel = SECRETS.get('CF_TUNNEL') == '1'
app.config['SESSION_COOKIE_SECURE'] = _cf_tunnel or (SECRETS.get('FORCE_HTTP') != '1')
# Sessions expire after 24 hours of inactivity (reset on every request).
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
# Limit request body to 16 MB — prevents disk exhaustion via player endpoints.
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# ── RATE LIMITING ─────────────────────────────────────────────────────────────

_login_attempts: dict[str, list[float]] = {}
MAX_ATTEMPTS   = 5
WINDOW_SECONDS = 300   # 5-minute window

def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    attempts = [t for t in _login_attempts.get(ip, []) if now - t < WINDOW_SECONDS]
    _login_attempts[ip] = attempts
    return len(attempts) >= MAX_ATTEMPTS

def _record_attempt(ip: str) -> None:
    now = time.time()
    attempts = [t for t in _login_attempts.get(ip, []) if now - t < WINDOW_SECONDS]
    attempts.append(now)
    _login_attempts[ip] = attempts
    # Opportunistic cleanup: prune any IPs whose most-recent attempt has aged out,
    # so this dict can't grow unbounded as unique IPs hit the login endpoint.
    stale = [k for k, v in _login_attempts.items() if not v or now - v[-1] > WINDOW_SECONDS]
    for k in stale:
        _login_attempts.pop(k, None)

def _clear_attempts(ip: str) -> None:
    _login_attempts.pop(ip, None)

# ── CSRF PROTECTION ───────────────────────────────────────────────────────────

def _csrf_check():
    """Verify that state-changing requests originate from this app's own origin.

    Strategy (in order):
    1. Compare Origin header to Host — the standard check for fetch/XHR.
    2. If no Origin, compare Referer to Host — fallback for same-origin POSTs
       where some browsers omit Origin.
    3. If neither header is present, reject the request outright.

    The old localhost bypass is intentionally removed: behind Cloudflare Tunnel
    every request arrives from 127.0.0.1, which would skip all CSRF checks.
    Modern browsers always include Origin or Referer on same-origin POSTs.
    """
    host = request.headers.get('Host', '')
    if not host:
        return jsonify({'error': 'CSRF check failed'}), 403

    origin = request.headers.get('Origin', '')
    if origin:
        origin_host = origin.split('://', 1)[-1].rstrip('/')
        if origin_host != host:
            return jsonify({'error': 'CSRF check failed'}), 403
        return None

    # No Origin — try Referer
    referer = request.headers.get('Referer', '')
    if referer:
        referer_host = referer.split('://', 1)[-1].split('/', 1)[0]
        if referer_host != host:
            return jsonify({'error': 'CSRF check failed'}), 403
        return None

    # Neither header present — reject
    return jsonify({'error': 'CSRF check failed'}), 403

# ── AUTH DECORATORS ───────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'username' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Not authenticated'}), 401
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated

def gm_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'username' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'gm':
            return jsonify({'error': 'Forbidden'}), 403
        return f(*args, **kwargs)
    return decorated

# ── SECURITY HEADERS ──────────────────────────────────────────────────────────

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options']        = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy']        = 'same-origin'
    return response

# ── ATOMIC FILE WRITES ────────────────────────────────────────────────────────

def _atomic_write(path: Path, text: str) -> None:
    """Write text to a file atomically: write to .tmp then rename.
    os.replace() is atomic on Linux — no partial/truncated files on crash."""
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(text, encoding='utf-8')
    os.replace(str(tmp), str(path))

# ── USER MANAGEMENT ───────────────────────────────────────────────────────────

_users_lock = threading.Lock()

def load_users() -> list:
    with _users_lock:
        if not USERS_FILE.exists():
            return []
        return json.loads(USERS_FILE.read_text(encoding='utf-8'))

def save_users(users: list) -> None:
    with _users_lock:
        _atomic_write(USERS_FILE, json.dumps(users, indent=2))

def get_user(username: str) -> dict | None:
    for u in load_users():
        if u['username'].lower() == username.lower():
            return u
    return None

def get_username_for_household(household: str) -> str | None:
    """Return the username whose household matches the given name (case-insensitive)."""
    for u in load_users():
        if (u.get('household') or '').lower() == household.lower():
            return u['username']
    return None

def _read_horses(username: str) -> list:
    path = PLAYER_DATA_DIR / username / 'horses.json'
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return []

def _write_horses(username: str, horses: list) -> None:
    d = PLAYER_DATA_DIR / username
    d.mkdir(parents=True, exist_ok=True)
    _atomic_write(d / 'horses.json', json.dumps(horses, indent=2))

def needs_setup() -> bool:
    """True if any user account has no password set yet."""
    users = load_users()
    if not users:
        return True
    return any(not u.get('password_hash') for u in users)

# ── CONFIG ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    try:
        return json.loads(CONFIG_FILE.read_text(encoding='utf-8'))
    except Exception:
        return {}

def save_config(cfg: dict) -> None:
    _atomic_write(CONFIG_FILE, json.dumps(cfg, indent=2))

def load_submissions():
    try:
        if SUBMISSIONS_FILE.exists():
            return json.loads(SUBMISSIONS_FILE.read_text(encoding='utf-8'))
    except Exception:
        pass
    return []

def save_submissions_data(subs):
    _atomic_write(SUBMISSIONS_FILE, json.dumps(subs, indent=2))

def get_save_path() -> Path | None:
    p = load_config().get('saveFile')
    return Path(p) if p else None

# ── CERTIFICATE ───────────────────────────────────────────────────────────────

def ensure_certificate() -> None:
    """Generate a self-signed cert/key pair if one doesn't exist.
    Set FORCE_HTTP=1 in secrets.env to disable HTTPS entirely."""
    if SECRETS.get('FORCE_HTTP') == '1':
        return
    if CERT_FILE.exists() and KEY_FILE.exists():
        return
    print('  [SSL]   Generating self-signed certificate (one-time)...')
    try:
        from OpenSSL import crypto
        k = crypto.PKey()
        k.generate_key(crypto.TYPE_RSA, 2048)

        cert = crypto.X509()
        subj = cert.get_subject()
        subj.C  = 'GB'
        subj.ST = 'Logres'
        subj.L  = 'Camelot'
        subj.O  = "Pendragon GM's Binder"
        subj.CN = 'localhost'
        cert.set_serial_number(1000)
        cert.gmtime_adj_notBefore(0)
        cert.gmtime_adj_notAfter(10 * 365 * 24 * 60 * 60)  # 10 years
        cert.set_issuer(cert.get_subject())
        cert.set_pubkey(k)
        cert.sign(k, 'sha256')

        CERT_FILE.write_bytes(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
        KEY_FILE.write_bytes(crypto.dump_privatekey(crypto.FILETYPE_PEM, k))
        print('  [SSL]   Certificate written to cert.pem / key.pem')
    except Exception as e:
        print(f'  [SSL]   WARNING: Could not generate certificate: {e}')
        print('  [SSL]   Server will start without HTTPS.')

# ── HTML TEMPLATES ────────────────────────────────────────────────────────────

_BASE_STYLE = """
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0d0b08;
    background-image:
      radial-gradient(ellipse at 50% 0%,rgba(139,90,43,.18) 0%,transparent 70%),
      repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.01) 2px,rgba(255,255,255,.01) 4px);
    font-family:'EB Garamond',Georgia,serif;color:#c8b99a;
  }
  .card{
    background:linear-gradient(160deg,#1a1410 0%,#110e0b 100%);
    border:1px solid #3a2e22;
    border-radius:4px;
    padding:2.5rem 3rem;
    width:100%;max-width:400px;
    box-shadow:0 8px 40px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,220,150,.06);
  }
  .crest{font-size:2.5rem;text-align:center;margin-bottom:.5rem;filter:drop-shadow(0 0 12px rgba(185,142,70,.4))}
  h1{
    font-family:'Cinzel Decorative',serif;font-size:1.1rem;font-weight:400;
    text-align:center;color:#c8a96e;letter-spacing:.05em;margin-bottom:.25rem;
  }
  .subtitle{text-align:center;font-style:italic;font-size:.9rem;color:#6b5a42;margin-bottom:2rem;}
  label{display:block;font-family:'Cinzel',serif;font-size:.75rem;letter-spacing:.08em;color:#8a7355;margin-bottom:.4rem;margin-top:1.2rem;}
  input{
    width:100%;padding:.6rem .8rem;
    background:#0d0b08;border:1px solid #2e2418;border-radius:3px;
    color:#c8b99a;font-family:'EB Garamond',serif;font-size:1rem;
    outline:none;transition:border-color .2s;
  }
  input:focus{border-color:#6b4f2a;}
  .btn{
    width:100%;margin-top:1.8rem;padding:.75rem;
    background:linear-gradient(180deg,#6b4f2a 0%,#4a3318 100%);
    border:1px solid #8a6535;border-radius:3px;
    color:#e8d5a8;font-family:'Cinzel',serif;font-size:.85rem;letter-spacing:.1em;
    cursor:pointer;transition:all .2s;
  }
  .btn:hover{background:linear-gradient(180deg,#7d5c32 0%,#5a3e20 100%);color:#f5e6c0;}
  .btn:disabled{opacity:.5;cursor:not-allowed;}
  .error{
    margin-top:1rem;padding:.6rem .8rem;
    background:rgba(139,30,30,.2);border:1px solid rgba(180,50,50,.3);border-radius:3px;
    color:#c87070;font-size:.85rem;text-align:center;
  }
  .info{
    margin-top:1rem;padding:.6rem .8rem;
    background:rgba(43,90,43,.2);border:1px solid rgba(60,130,60,.3);border-radius:3px;
    color:#70c870;font-size:.85rem;text-align:center;
  }
  .divider{border:none;border-top:1px solid #1e1810;margin:1.5rem 0;}
  a{color:#8a6535;text-decoration:none;font-family:'Cinzel',serif;font-size:.75rem;letter-spacing:.05em;}
  a:hover{color:#c8a96e;}
  .footer-link{text-align:center;margin-top:1.2rem;}
  .user-info{text-align:center;font-size:.8rem;color:#6b5a42;margin-bottom:1.5rem;font-style:italic;}
</style>
"""

LOGIN_HTML = """<!DOCTYPE html><html lang="en"><head>""" + _BASE_STYLE + """
<title>Pendragon — Enter the Binder</title>
</head><body>
<div class="card">
  <div class="crest">⚜</div>
  <h1>GM's Binder</h1>
  <div class="subtitle">Anno Domini {{ year }}</div>
  {% if error %}<div class="error">{{ error }}</div>{% endif %}
  <form method="POST">
    <label>Knight or Steward</label>
    <input type="text" name="username" autocomplete="username" autofocus required value="{{ username }}">
    <label>Passphrase</label>
    <input type="password" name="password" autocomplete="current-password" required>
    <button class="btn" type="submit">Enter the Hall</button>
  </form>
</div>
</body></html>
"""

SETUP_HTML = """<!DOCTYPE html><html lang="en"><head>""" + _BASE_STYLE + """
<title>Pendragon — First Muster</title>
</head><body>
<div class="card" style="max-width:480px">
  <div class="crest">🛡</div>
  <h1>First Muster</h1>
  <div class="subtitle">Set passwords before the gates open</div>
  {% if error %}<div class="error">{{ error }}</div>{% endif %}
  {% if success %}<div class="info">{{ success }}</div>{% endif %}
  <form method="POST">
    {% for user in users %}
    <label>{{ user.username }}{% if user.role == 'gm' %} — GM{% else %} — {{ user.household }}{% endif %}</label>
    <input type="password" name="pw_{{ user.username }}"
           placeholder="{% if user.password_hash %}(already set — leave blank to keep){% else %}Set a password{% endif %}"
           autocomplete="new-password">
    {% endfor %}
    <button class="btn" type="submit">Save &amp; Open the Gates</button>
  </form>
</div>
</body></html>
"""

ACCOUNT_HTML = """<!DOCTYPE html><html lang="en"><head>""" + _BASE_STYLE + """
<title>Pendragon — Change Passphrase</title>
</head><body>
<div class="card">
  <div class="crest">🗝</div>
  <h1>Change Passphrase</h1>
  <div class="user-info">Signed in as {{ username }}</div>
  {% if error %}<div class="error">{{ error }}</div>{% endif %}
  {% if success %}<div class="info">{{ success }}</div>{% endif %}
  <form method="POST">
    <label>Current Passphrase</label>
    <input type="password" name="current" autocomplete="current-password" required>
    <label>New Passphrase</label>
    <input type="password" name="new" autocomplete="new-password" required minlength="10">
    <label>Confirm New Passphrase</label>
    <input type="password" name="confirm" autocomplete="new-password" required>
    <button class="btn" type="submit">Update Passphrase</button>
  </form>
  <hr class="divider">
  <div class="footer-link"><a href="/">Return to the Binder</a></div>
</div>
</body></html>
"""

# ── ROUTES: AUTH ──────────────────────────────────────────────────────────────

@app.route('/setup', methods=['GET', 'POST'])
def setup():
    # Setup is only accessible from localhost — prevents remote takeover if
    # users.json is accidentally deleted on a public-facing deployment.
    if request.remote_addr not in ('127.0.0.1', '::1'):
        return jsonify({'error': 'Setup only accessible from localhost'}), 403
    if not needs_setup():
        return redirect(url_for('login'))

    users = load_users()
    error = None
    success = None

    if request.method == 'POST':
        updated = False
        for user in users:
            field = f"pw_{user['username']}"
            pw = request.form.get(field, '').strip()
            if pw:
                if len(pw) < 10:
                    error = f"Password for {user['username']} must be at least 10 characters."
                    break
                user['password_hash'] = generate_password_hash(pw)
                updated = True

        if not error:
            save_users(users)
            if not needs_setup():
                return redirect(url_for('login'))
            success = "Passwords saved. Fill in any remaining accounts."

    return render_template_string(SETUP_HTML, users=users, error=error, success=success)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if needs_setup():
        return redirect(url_for('setup'))
    if 'username' in session:
        return redirect(url_for('index'))

    error = None
    prefill = ''

    if request.method == 'POST':
        # Use Cloudflare's real-IP header when behind a tunnel; fall back to
        # direct remote addr for LAN use.
        ip = request.headers.get('CF-Connecting-IP') or request.remote_addr
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        prefill = username

        if _is_rate_limited(ip):
            error = "Too many failed attempts. Please wait a few minutes."
        else:
            user = get_user(username)
            if user and user.get('password_hash') and check_password_hash(user['password_hash'], password):
                _clear_attempts(ip)
                session.clear()
                session.permanent    = True   # enables PERMANENT_SESSION_LIFETIME
                session['username']  = user['username']
                session['role']      = user['role']
                session['household'] = user.get('household')
                next_url = request.args.get('next') or url_for('index')
                # Prevent open-redirect: only allow same-origin relative paths.
                if not next_url.startswith('/') or next_url.startswith('//'):
                    next_url = url_for('index')
                return redirect(next_url)
            else:
                _record_attempt(ip)
                error = "Invalid username or passphrase."

    year = 498  # fallback; real year lives in the save file
    try:
        save_path = get_save_path()
        if save_path and save_path.exists():
            save_data = json.loads(save_path.read_text(encoding='utf-8'))
            year = save_data.get('year', 498)
    except Exception:
        pass
    return render_template_string(LOGIN_HTML, error=error, username=prefill, year=year)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/account', methods=['GET', 'POST'])
@login_required
def account():
    error = None
    success = None

    if request.method == 'POST':
        current = request.form.get('current', '')
        new_pw  = request.form.get('new', '').strip()
        confirm = request.form.get('confirm', '').strip()

        user = get_user(session['username'])
        if not user or not check_password_hash(user['password_hash'], current):
            error = "Current passphrase is incorrect."
        elif len(new_pw) < 10:
            error = "New passphrase must be at least 10 characters."
        elif new_pw != confirm:
            error = "New passphrases do not match."
        else:
            users = load_users()
            for u in users:
                if u['username'].lower() == session['username'].lower():
                    u['password_hash'] = generate_password_hash(new_pw)
                    break
            save_users(users)
            success = "Passphrase updated successfully."

    return render_template_string(ACCOUNT_HTML,
                                  username=session['username'],
                                  error=error, success=success)

# ── ROUTES: APP ───────────────────────────────────────────────────────────────

@app.route('/sw.js')
def service_worker():
    """Service worker — must be served without auth and with correct MIME type."""
    return send_from_directory(str(BASE_DIR), 'sw.js',
                               mimetype='application/javascript')


@app.route('/offline.html')
def offline_page():
    """Offline fallback — must be cacheable by the service worker before auth."""
    return send_from_directory(str(BASE_DIR), 'offline.html')


@app.route('/')
@login_required
def index():
    html = (BASE_DIR / 'index.html').read_text(encoding='utf-8')
    user_data = json.dumps({
        'username': session['username'],
        'role':     session['role'],
        'household': session.get('household'),
    })
    # Inject user identity + apply CSS role class before any body content renders
    early_script = (
        f'<script>window.__USER__={user_data};'
        f'(function(){{var r=window.__USER__.role;'
        f'document.documentElement.classList.add(r==="gm"?"is-gm":"is-player")}})()</script>\n'
    )
    html = html.replace('<head>', '<head>\n' + early_script, 1)
    # Cache busting: append ?v=VERSION to all .js and .css asset URLs so
    # browsers and Cloudflare fetch fresh files after each deployment.
    html = re.sub(
        r'(src|href)="([^"]+\.(js|css))"',
        lambda m: f'{m.group(1)}="{m.group(2)}?v={APP_VERSION}"',
        html,
    )
    return html


@app.route('/<path:filename>')
@login_required
def static_files(filename):
    # Block sensitive files from ever being served.
    # Check every path component, not just the first, so that
    # e.g. "backups/secrets.env" is caught as well as "secrets.env".
    parts = Path(filename).parts
    if any(p in BLOCKED_FILES or p.startswith('.') for p in parts):
        return jsonify({'error': 'Forbidden'}), 403
    if any(p.lower().endswith(BLOCKED_SUFFIXES) for p in parts):
        return jsonify({'error': 'Forbidden'}), 403
    # Block the backups directory entirely — contains full campaign save history.
    if parts and parts[0] == 'backups':
        return jsonify({'error': 'Forbidden'}), 403
    return send_from_directory(str(BASE_DIR), filename)

# ── ROUTES: API ───────────────────────────────────────────────────────────────

@app.route('/api/me')
@login_required
def api_me():
    """Return current user info for the frontend."""
    return jsonify({
        'username':  session['username'],
        'role':      session['role'],
        'household': session.get('household'),
    })


@app.route('/api/keep-alive', methods=['POST'])
@login_required
def api_keep_alive():
    """Extend the session lifetime. Called by the client-side idle warning."""
    session.modified = True
    return jsonify({'ok': True})


@app.route('/api/config', methods=['GET'])
@login_required
def api_get_config():
    cfg  = load_config()
    path = cfg.get('saveFile')
    return jsonify({
        'saveFile':   path,
        'exists':     Path(path).exists() if path else False,
        'configured': bool(path),
        'hasApiKey':  bool(SECRETS.get('ANTHROPIC_KEY')),
    })


@app.route('/api/config', methods=['POST'])
@gm_required
def api_set_config():
    try:
        err = _csrf_check()
        if err: return err
        data = request.get_json(force=True)
        cfg  = load_config()

        if 'saveFile' in data:
            raw_path = data['saveFile'].strip()
            if not raw_path:
                return jsonify({'error': 'No path provided'}), 400
            # Validate the path stays within the home directory and is a .json file.
            resolved = Path(raw_path).resolve()
            if not str(resolved).startswith(str(Path.home())):
                return jsonify({'error': 'Save path must be within your home directory'}), 400
            if resolved.suffix.lower() != '.json':
                return jsonify({'error': 'Save file must be a .json file'}), 400
            path = str(resolved)
            cfg['saveFile'] = path
            print(f'  [Config] Save file set to: {path}')

        # anthropicKey changes via UI are ignored — key lives in secrets.env
        if 'anthropicKey' in data:
            print('  [Config] API key change via UI ignored — edit secrets.env directly.')

        save_config(cfg)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load')
@gm_required
def api_load():
    path = get_save_path()
    if not path:
        return jsonify({'status': 'no_config'})
    if not path.exists():
        return jsonify({'status': 'file_missing', 'path': str(path)})
    try:
        data = path.read_text(encoding='utf-8')
        json.loads(data)  # validate
        print(f'  [Load]  {path.name} ({len(data):,} bytes)')
        return app.response_class(data, mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/player-load')
@login_required
def api_player_load():
    """Scoped data endpoint for player clients.
    Returns the same save data as /api/load for now; this is the controlled
    path we can filter down in Phase 3 without touching the GM endpoint."""
    path = get_save_path()
    if not path:
        return jsonify({'status': 'no_config'})
    if not path.exists():
        return jsonify({'status': 'file_missing', 'path': str(path)})
    try:
        data = path.read_text(encoding='utf-8')
        json.loads(data)  # validate
        return app.response_class(data, mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save', methods=['POST'])
@gm_required
def api_save():
    try:
        err = _csrf_check()
        if err: return err
        body = request.get_data(as_text=True)
        if not body:
            return jsonify({'error': 'empty body'}), 400
        json.loads(body)  # validate

        path = get_save_path()
        if not path:
            return jsonify({'error': 'No save file configured'}), 400

        path.parent.mkdir(parents=True, exist_ok=True)
        with _save_lock:
            if path.exists():
                _rotate_backup(path)
            _atomic_write(path, body)

        now = datetime.now().strftime('%H:%M:%S')
        print(f'  [Save]  {path.name} — {len(body):,} bytes at {now}')

        if _restart_pending.is_set():
            print('  [Console] Save complete — restarting now...')
            threading.Thread(target=_do_restart, daemon=True).start()

        return jsonify({'ok': True, 'bytes': len(body), 'time': now})
    except json.JSONDecodeError as e:
        return jsonify({'error': 'Invalid JSON: ' + str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/relationships', methods=['POST'])
@login_required
def api_save_relationships():
    """Players save their household's relationships + tree positions/lock.
    GM may also use this (e.g. future tooling). Players are restricted to
    relationships that involve at least one NPC from their household."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'invalid payload'}), 400

    relationships = data.get('relationships')
    tree_pos  = data.get('treePos')
    tree_lock = data.get('treeLock')

    if not isinstance(relationships, list):
        return jsonify({'error': 'relationships must be an array'}), 400

    path = get_save_path()
    if not path:
        return jsonify({'error': 'No save file configured'}), 400

    with _save_lock:
        try:
            binder = json.loads(path.read_text(encoding='utf-8'))
        except Exception as e:
            return jsonify({'error': str(e)}), 500

        if session.get('role') != 'gm':
            user_hh = (session.get('household') or '').lower()
            if not user_hh:
                return jsonify({'error': 'No household assigned'}), 403

            hh_npc_ids = {
                n['id'] for n in binder.get('npcs', binder.get('living', []) + binder.get('dead', []))
                if (n.get('household') or '').lower() == user_hh
            }

            # Validate and filter: only accept well-formed relationships involving this household
            VALID_REL_TYPES = {
                'Spouse','Betrothed','Lover','Former Spouse',
                'Child','Adopted Child','Bastard','Parent','Adoptive Parent',
                'Sibling','Half-Sibling','Aunt/Uncle','Niece/Nephew','Cousin',
                'Grandparent','Grandchild','Sworn Brother/Sister',
                'Squire','Former Squire','Page','Vassal','Ward','Guardian','Other',
            }
            hh_relationships = []
            for r in relationships:
                if not isinstance(r, dict): continue
                src = r.get('sourceId', '')
                tgt = r.get('targetId', '')
                rel_type = r.get('type', '')
                if not isinstance(src, str) or not isinstance(tgt, str): continue
                if rel_type not in VALID_REL_TYPES: continue
                if len(r.get('notes', '')) > 500: continue
                if src not in hh_npc_ids and tgt not in hh_npc_ids: continue
                hh_relationships.append(r)

            # Preserve relationships that don't touch this household, replace the rest
            preserved = [
                r for r in binder.get('relationships', [])
                if r.get('sourceId') not in hh_npc_ids and r.get('targetId') not in hh_npc_ids
            ]
            binder['relationships'] = preserved + hh_relationships
        else:
            binder['relationships'] = [r for r in relationships if isinstance(r, dict)]

        if isinstance(tree_pos, dict):
            existing_pos = binder.get('treePos', {})
            if session.get('role') != 'gm':
                # Players may only update positions for NPCs in their own household
                filtered_pos = {k: v for k, v in tree_pos.items() if k in hh_npc_ids}
                existing_pos.update(filtered_pos)
            else:
                existing_pos.update(tree_pos)
            binder['treePos'] = existing_pos

        if isinstance(tree_lock, dict):
            existing_lock = binder.get('treeLock', {})
            if session.get('role') != 'gm':
                # Players may only update lock state for their own household
                filtered_lock = {k: v for k, v in tree_lock.items()
                                 if (session.get('household') or '').lower() == k.lower()}
                existing_lock.update(filtered_lock)
            else:
                existing_lock.update(tree_lock)
            binder['treeLock'] = existing_lock

        _atomic_write(path, json.dumps(binder))

    return jsonify({'ok': True})


@app.route('/api/new', methods=['POST'])
@gm_required
def api_new():
    err = _csrf_check()
    if err: return err
    try:
        data = request.get_json(force=True)
        raw  = data.get('saveFile', '').strip()
        if not raw:
            return jsonify({'error': 'No path'}), 400
        path = Path(raw).resolve()
        home = Path.home()
        # Restrict to home directory and require .json extension
        if not (str(path).startswith(str(home) + '/') or path == home):
            return jsonify({'error': 'Path must be within your home directory'}), 400
        if path.suffix != '.json':
            return jsonify({'error': 'Save file must have a .json extension'}), 400
        path.parent.mkdir(parents=True, exist_ok=True)
        empty = json.dumps({'version': 1, 'year': 498,
                            'living': [], 'dead': [], 'households': [],
                            'manors': {}, 'relationships': [], 'treePos': {}})
        _atomic_write(path, empty)
        cfg = load_config()
        cfg['saveFile'] = str(path)
        save_config(cfg)
        print(f'  [New]   Created {path}')
        return jsonify({'ok': True, 'saveFile': str(path)})
    except Exception as e:
        return jsonify({'error': 'Could not create save file'}), 500


@app.route('/api/ai', methods=['POST'])
@gm_required
def api_ai():
    """Proxy to Anthropic API. GM only.
    Only forwards specific safe fields — prevents model/token abuse via
    a stolen GM session or crafted request body."""
    api_key = SECRETS.get('ANTHROPIC_KEY', '').strip()
    if not api_key:
        return jsonify({'error': 'No Anthropic API key configured'}), 400

    raw = request.get_json(force=True)
    if not raw:
        return jsonify({'error': 'Empty request body'}), 400

    # Reconstruct a safe payload — hardcode the model, cap max_tokens.
    try:
        payload = {
            'model':      'claude-haiku-4-5-20251001',
            'max_tokens': min(int(raw.get('max_tokens', 300)), 500),
            'system':     str(raw.get('system', '')),
            'messages':   raw.get('messages', []),
        }
    except (ValueError, TypeError) as e:
        return jsonify({'error': 'Invalid request: ' + str(e)}), 400

    body = json.dumps(payload).encode('utf-8')
    try:
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body,
            headers={
                'Content-Type':      'application/json',
                'x-api-key':         api_key,
                'anthropic-version': '2023-06-01',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            resp_body = r.read()
            print('  [AI]    Flavor text generated')
            return app.response_class(resp_body, status=r.status, mimetype='application/json')
    except urllib.error.HTTPError as e:
        return app.response_class(e.read(), status=e.code, mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/drives')
@gm_required
def api_drives():
    """GM only — exposes filesystem (Linux: home + common mount points)."""
    locations = []
    home = Path.home()
    if home.exists():
        locations.append({'label': '~ (home)', 'path': str(home)})
    for mnt in ['/mnt', '/media', '/']:
        p = Path(mnt)
        if p.exists():
            locations.append({'label': mnt, 'path': mnt})
    return jsonify({'base_dir': str(BASE_DIR), 'drives': locations})


@app.route('/api/succession', methods=['POST'])
@login_required
def api_succession():
    """Player Knight succession — players may act on their own household only."""
    err = _csrf_check()
    if err: return err
    data    = request.get_json(force=True)
    user_hh = session.get('household', '').lower()
    is_gm   = session.get('role') == 'gm'

    path = get_save_path()
    if not path or not path.exists():
        return jsonify({'error': 'No save file configured'}), 400

    old_pk_id  = data.get('old_pk_id')
    new_pk_id  = data.get('new_pk_id')
    old_action = data.get('old_action')   # 'died' | 'retired' | 'na'
    life_event = data.get('life_event')   # dict for retired
    death_data = data.get('death_data')   # dict for died

    ts = int(datetime.now().timestamp() * 1000)

    # Hold _save_lock for the full read-modify-write to prevent TOCTOU races.
    with _save_lock:
        save_data = json.loads(path.read_text(encoding='utf-8'))
        living    = save_data.get('living', [])
        dead      = save_data.get('dead', [])

        def hh_of(npc_id, pool):
            npc = next((n for n in pool if n.get('id') == npc_id), None)
            return (npc.get('household') or '').lower() if npc else None

        # Players may only act on their own household.
        if not is_gm:
            if not new_pk_id:
                return jsonify({'error': 'new_pk_id is required'}), 400
            for npc_id in filter(None, [old_pk_id, new_pk_id]):
                hh = hh_of(npc_id, living)
                if hh is None:
                    return jsonify({'error': 'NPC not found'}), 404
                if hh != user_hh:
                    return jsonify({'error': 'Forbidden'}), 403

        # Handle old PK
        if old_action == 'died' and old_pk_id and death_data:
            idx = next((i for i, n in enumerate(living) if n.get('id') == old_pk_id), None)
            if idx is not None:
                npc = living.pop(idx)
                npc['status']        = 'Dead'
                npc['year_died']     = death_data.get('year', save_data.get('year', 499))
                cause = str(death_data.get('cause', ''))[:2000]
                if cause:
                    npc['notes'] = ((npc.get('notes') or '') + f'\n\n† {cause}').strip()
                dead.append(npc)

        elif old_action == 'retired' and old_pk_id:
            for npc in living:
                if npc.get('id') == old_pk_id:
                    npc['role'] = 'Knight'
                    if life_event:
                        if 'soloEvents' not in npc:
                            npc['soloEvents'] = []
                        npc['soloEvents'].insert(0, {
                            'id':         f'evt_{ts}',
                            'year':        life_event.get('year', save_data.get('year', 499)),
                            'season':      life_event.get('season', 'winter'),
                            'title':       str(life_event.get('title', 'Retired from Questing'))[:200],
                            'mechDesc':    str(life_event.get('mechDesc', ''))[:2000],
                            'flavorText':  None,
                            'userNotes':   str(life_event.get('userNotes', ''))[:2000],
                        })
                    break

        # Promote new PK
        if new_pk_id:
            for npc in living:
                if npc.get('id') == new_pk_id:
                    npc['role'] = 'Player Knight'
                    break

        save_data['living'] = living
        save_data['dead']   = dead

        if path.exists():
            _rotate_backup(path)
        _atomic_write(path, json.dumps(save_data, indent=2, ensure_ascii=False))

    if _restart_pending.is_set():
        print('  [Console] Save complete — restarting now...')
        threading.Thread(target=_do_restart, daemon=True).start()

    return jsonify({'ok': True})


@app.route('/api/browse')
@gm_required
def api_browse():
    """GM only — filesystem browser for save file picker. Restricted to $HOME."""
    try:
        home     = Path.home()
        req_path = request.args.get('path', '').strip() or str(BASE_DIR)
        p = Path(req_path).resolve()
        # Never browse outside the home directory
        if not (str(p).startswith(str(home) + '/') or p == home):
            p = home
        if not p.exists() or not p.is_dir():
            p = home

        entries = []
        if p.parent != p:
            entries.append({'name': '..', 'path': str(p.parent), 'type': 'dir'})

        for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            try:
                entries.append({
                    'name': child.name,
                    'path': str(child),
                    'type': 'dir' if child.is_dir() else 'file',
                    'ext':  child.suffix.lower() if child.is_file() else '',
                })
            except PermissionError:
                pass

        return jsonify({'current': str(p), 'entries': entries})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── MULTIPLAYER ROUTES ────────────────────────────────────────────────────────

@app.route('/api/broadcast', methods=['POST'])
@gm_required
def api_broadcast():
    """GM sends a broadcast message to all connected players."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True)
    msg  = (data.get('message') or '').strip()
    if not msg:
        return jsonify({'error': 'Message is required'}), 400
    if len(msg) > 500:
        return jsonify({'error': 'Message too long (500 char max)'}), 400

    entry = {
        'id':        f'bc_{int(time.time() * 1000)}',
        'message':   msg,
        'timestamp': time.time(),
        'sender':    session['username'],
    }
    with _mp_lock:
        _broadcasts.append(entry)
        if len(_broadcasts) > 20:
            _broadcasts[:] = _broadcasts[-20:]

    print(f'  [Broadcast] {session["username"]}: {msg[:60]}')
    return jsonify({'ok': True, 'broadcast': entry})


@app.route('/api/submissions', methods=['GET'])
@gm_required
def api_get_submissions():
    with _submissions_lock:
        subs = load_submissions()
    return jsonify(subs)


@app.route('/api/submissions', methods=['POST'])
@login_required
def api_post_submission():
    err = _csrf_check()
    if err: return err
    if session.get('role') == 'gm':
        return jsonify({'error': 'GMs add directly to the Chronicle'}), 400
    data = request.get_json(force=True) or {}
    text = data.get('text', '').strip()
    year = data.get('year')
    if not text or year is None:
        return jsonify({'error': 'text and year required'}), 400
    try:
        year = int(year)
    except (ValueError, TypeError):
        return jsonify({'error': 'year must be an integer'}), 400
    sub = {
        'id':             'sub-' + str(int(time.time() * 1000)),
        'playerUsername': session['username'],
        'subjectId':      str(data.get('subjectId', '')),
        'subjectName':    str(data.get('subjectName', ''))[:120],
        'year':           year,
        'cat':            data.get('cat', 'personal'),
        'text':           text[:4000],
        'ts':             int(time.time() * 1000),
    }
    with _submissions_lock:
        subs = load_submissions()
        subs.append(sub)
        save_submissions_data(subs)
    print(f'  [Submit] {session["username"]} submitted chronicle entry for {year} AD')
    return jsonify({'ok': True, 'id': sub['id']})


@app.route('/api/submissions/<sub_id>/approve', methods=['POST'])
@gm_required
def api_approve_submission(sub_id):
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True) or {}
    with _submissions_lock:
        subs = load_submissions()
        sub = next((s for s in subs if s['id'] == sub_id), None)
        if not sub:
            return jsonify({'error': 'not found'}), 404
        final_text = data.get('text', sub['text']).strip()
        cat        = data.get('cat', sub.get('cat', 'personal'))
        year_key   = str(sub['year'])
    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'save file not found'}), 500
    with _save_lock:
        binder = json.loads(save_path.read_text(encoding='utf-8'))
        if 'chronicle' not in binder:
            binder['chronicle'] = {}
        if year_key not in binder['chronicle']:
            binder['chronicle'][year_key] = []
        binder['chronicle'][year_key].append({
            'id':   'ev-' + str(int(time.time() * 1000)),
            'text': final_text,
            'cat':  cat,
            'ts':   int(time.time() * 1000),
        })
        _rotate_backup(save_path)
        _atomic_write(save_path, json.dumps(binder, indent=2))
    with _submissions_lock:
        subs = [s for s in load_submissions() if s['id'] != sub_id]
        save_submissions_data(subs)
    print(f'  [Chronicle] GM approved submission {sub_id} for {year_key} AD')
    return jsonify({'ok': True})


@app.route('/api/submissions/<sub_id>/dismiss', methods=['POST'])
@gm_required
def api_dismiss_submission(sub_id):
    err = _csrf_check()
    if err: return err
    with _submissions_lock:
        subs = [s for s in load_submissions() if s['id'] != sub_id]
        save_submissions_data(subs)
    return jsonify({'ok': True})


@app.route('/api/broadcasts')
@login_required
def api_broadcasts():
    """Return broadcasts newer than the given timestamp."""
    since = float(request.args.get('since', 0))
    with _mp_lock:
        result = [b for b in _broadcasts if b['timestamp'] > since]
    return jsonify({'broadcasts': result})


@app.route('/api/heartbeat', methods=['POST'])
@login_required
def api_heartbeat():
    """Update presence for the current user."""
    user = get_user(session['username'])
    with _mp_lock:
        _presence[session['username']] = {
            'displayName': user.get('username', session['username']) if user else session['username'],
            'role':        session.get('role', 'player'),
            'last_seen':   time.time(),
        }
    return jsonify({'ok': True})


@app.route('/api/presence')
@login_required
def api_presence():
    """Return list of users seen in the last 60 seconds."""
    cutoff = time.time() - 60
    with _mp_lock:
        # Clean up stale entries
        stale = [k for k, v in _presence.items() if v['last_seen'] < cutoff]
        for k in stale:
            del _presence[k]
        result = [
            {'username': k, 'displayName': v['displayName'], 'role': v['role']}
            for k, v in _presence.items()
        ]
    return jsonify({'users': result})


# ── HORSES ────────────────────────────────────────────────────────────────────

@app.route('/api/horses')
@login_required
def api_get_horses():
    """Player: read own horses."""
    horses = _read_horses(session['username'])
    return jsonify({'horses': horses})


@app.route('/api/horses', methods=['POST'])
@login_required
def api_save_horses():
    """Player: save own horses."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('horses'), list):
        return jsonify({'error': 'Invalid payload'}), 400
    _write_horses(session['username'], data['horses'])
    return jsonify({'ok': True})


@app.route('/api/horses/<household>')
@gm_required
def api_get_horses_gm(household):
    """GM: read any household's horses."""
    username = get_username_for_household(household)
    if not username:
        return jsonify({'horses': []})
    return jsonify({'horses': _read_horses(username)})


@app.route('/api/horses/<household>', methods=['POST'])
@gm_required
def api_save_horses_gm(household):
    """GM: save any household's horses."""
    err = _csrf_check()
    if err: return err
    username = get_username_for_household(household)
    if not username:
        return jsonify({'error': 'No player found for that household'}), 404
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('horses'), list):
        return jsonify({'error': 'Invalid payload'}), 400
    _write_horses(username, data['horses'])
    return jsonify({'ok': True})


# ── PINS ─────────────────────────────────────────────────────────────────────

def _read_pins(username: str) -> list:
    path = PLAYER_DATA_DIR / username / 'pins.json'
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return []


def _write_pins(username: str, pins: list) -> None:
    d = PLAYER_DATA_DIR / username
    d.mkdir(parents=True, exist_ok=True)
    _atomic_write(d / 'pins.json', json.dumps(pins, indent=2))


@app.route('/api/pins')
@login_required
def api_get_pins():
    """Any logged-in user: read own pinned NPC IDs."""
    return jsonify({'pins': _read_pins(session['username'])})


@app.route('/api/pins', methods=['POST'])
@login_required
def api_save_pins():
    """Any logged-in user: save own pinned NPC IDs."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('pins'), list):
        return jsonify({'error': 'Invalid payload'}), 400
    pins = [str(p) for p in data['pins'] if isinstance(p, str)]
    _write_pins(session['username'], pins)
    return jsonify({'ok': True})


# ── NOTES ─────────────────────────────────────────────────────────────────────

_NOTES_DEFAULTS = {'general': '', 'manor_notes': '', 'impressions': {}}


def _read_notes(username: str) -> dict:
    """Returns notes dict with defaults if missing."""
    path = PLAYER_DATA_DIR / username / 'notes.json'
    if not path.exists():
        return dict(_NOTES_DEFAULTS)
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return {
            'general':     data.get('general', ''),
            'manor_notes': data.get('manor_notes', ''),
            'impressions': data.get('impressions', {}),
        }
    except Exception:
        return dict(_NOTES_DEFAULTS)


def _write_notes(username: str, data: dict) -> None:
    """Atomic write to player_data/{username}/notes.json."""
    d = PLAYER_DATA_DIR / username
    d.mkdir(parents=True, exist_ok=True)
    _atomic_write(d / 'notes.json', json.dumps(data, indent=2))


@app.route('/api/notes')
@login_required
def api_get_notes():
    """Any logged-in user: read own notes."""
    return jsonify(_read_notes(session['username']))


@app.route('/api/notes', methods=['POST'])
@login_required
def api_save_notes():
    """Any logged-in user: save own notes."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400
    general     = data.get('general', '')
    manor_notes = data.get('manor_notes', '')
    impressions = data.get('impressions', {})
    if not isinstance(general, str) or len(general) > 10000:
        return jsonify({'error': 'general must be a string ≤10000 chars'}), 400
    if not isinstance(manor_notes, str) or len(manor_notes) > 10000:
        return jsonify({'error': 'manor_notes must be a string ≤10000 chars'}), 400
    if not isinstance(impressions, dict):
        return jsonify({'error': 'impressions must be an object'}), 400
    _write_notes(session['username'], {
        'general': general,
        'manor_notes': manor_notes,
        'impressions': impressions,
    })
    return jsonify({'ok': True})


@app.route('/api/notes/<username>')
@gm_required
def api_get_notes_gm(username):
    """GM: read any player's notes."""
    if not get_user(username):
        return jsonify({'error': 'User not found'}), 404
    return jsonify(_read_notes(username))


@app.route('/api/notes/<username>', methods=['POST'])
@gm_required
def api_save_notes_gm(username):
    """GM: save to any player's notes and push a notification."""
    err = _csrf_check()
    if err: return err
    if not get_user(username):
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400
    general     = data.get('general', '')
    manor_notes = data.get('manor_notes', '')
    impressions = data.get('impressions', {})
    if not isinstance(general, str) or len(general) > 10000:
        return jsonify({'error': 'general must be a string ≤10000 chars'}), 400
    if not isinstance(manor_notes, str) or len(manor_notes) > 10000:
        return jsonify({'error': 'manor_notes must be a string ≤10000 chars'}), 400
    if not isinstance(impressions, dict):
        return jsonify({'error': 'impressions must be an object'}), 400
    _write_notes(username, {
        'general': general,
        'manor_notes': manor_notes,
        'impressions': impressions,
    })
    _push_notification(username, 'note', 'The GM updated your notes')
    return jsonify({'ok': True})


# ── COMMENTS ──────────────────────────────────────────────────────────────────

COMMENTS_FILE = BASE_DIR / 'comments.json'
_comments_lock = threading.Lock()


def _read_comments() -> list:
    """Returns comments list from comments.json."""
    with _comments_lock:
        if not COMMENTS_FILE.exists():
            return []
        try:
            return json.loads(COMMENTS_FILE.read_text(encoding='utf-8'))
        except Exception:
            return []


def _write_comments(comments: list) -> None:
    """Atomic write to comments.json."""
    with _comments_lock:
        _atomic_write(COMMENTS_FILE, json.dumps(comments, indent=2))


def _serialize_comment(c: dict, is_gm: bool) -> dict:
    """Flatten comment for API responses — adds convenience fields the client expects."""
    out = dict(c)
    history = out.get('history') or []
    latest  = history[-1] if history else {}
    out['author']    = out.get('authorUsername', '')
    out['text']      = latest.get('text', '')
    out['timestamp'] = latest.get('ts', '')
    if not is_gm:
        out['history'] = [latest] if latest else []
    return out


@app.route('/api/comments/<npc_id>')
@login_required
def api_get_comments(npc_id):
    """Any logged-in user: get comments for an NPC.
    Players see only the latest history entry; GM sees full history."""
    is_gm = session.get('role') == 'gm'
    all_comments = _read_comments()
    result = [_serialize_comment(c, is_gm) for c in all_comments if c.get('npcId') == npc_id]
    return jsonify({'comments': result})


@app.route('/api/comments', methods=['POST'])
@login_required
def api_post_comment():
    """Any logged-in user: create a new comment."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400
    npc_id = data.get('npcId', '')
    text   = data.get('text', '')
    parent_id = data.get('parentId', None)
    if not isinstance(npc_id, str) or not npc_id:
        return jsonify({'error': 'npcId is required'}), 400
    if not isinstance(text, str) or not text or len(text) > 2000:
        return jsonify({'error': 'text must be a non-empty string ≤2000 chars'}), 400
    if parent_id is not None and not isinstance(parent_id, str):
        return jsonify({'error': 'parentId must be a string or null'}), 400

    import secrets as _secrets
    comment_id = 'cmt-' + _secrets.token_hex(6)
    ts = datetime.utcnow().isoformat() + 'Z'
    author = session['username']
    new_comment = {
        'id':             comment_id,
        'npcId':          npc_id,
        'authorUsername': author,
        'parentId':       parent_id,
        'history':        [{'text': text, 'ts': ts}],
        'deleted':        False,
        'deletedBy':      None,
    }

    all_comments = _read_comments()
    all_comments.append(new_comment)
    _write_comments(all_comments)

    # Notify all other users
    all_users = load_users()
    for u in all_users:
        uname = u['username']
        if uname != author:
            _push_notification(
                uname, 'comment',
                f'{author} commented on {npc_id}',
                link=npc_id,
            )

    return jsonify({'ok': True, 'comment': _serialize_comment(new_comment, session.get('role') == 'gm')})


@app.route('/api/comments/<comment_id>', methods=['PATCH'])
@login_required
def api_edit_comment(comment_id):
    """Owner or GM: edit a comment (appends to history)."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400
    text = data.get('text', '')
    if not isinstance(text, str) or not text or len(text) > 2000:
        return jsonify({'error': 'text must be a non-empty string ≤2000 chars'}), 400

    all_comments = _read_comments()
    target = next((c for c in all_comments if c['id'] == comment_id), None)
    if not target:
        return jsonify({'error': 'Comment not found'}), 404
    is_gm   = session.get('role') == 'gm'
    is_owner = target['authorUsername'] == session['username']
    if not is_owner and not is_gm:
        return jsonify({'error': 'Forbidden'}), 403
    if target.get('deleted'):
        return jsonify({'error': 'Cannot edit a deleted comment'}), 400

    ts = datetime.utcnow().isoformat() + 'Z'
    target['history'].append({'text': text, 'ts': ts})
    _write_comments(all_comments)
    is_gm = session.get('role') == 'gm'
    return jsonify({'ok': True, 'comment': _serialize_comment(target, is_gm)})


@app.route('/api/comments/<comment_id>', methods=['DELETE'])
@login_required
def api_delete_comment(comment_id):
    """Owner or GM: soft-delete a comment."""
    err = _csrf_check()
    if err: return err

    all_comments = _read_comments()
    target = next((c for c in all_comments if c['id'] == comment_id), None)
    if not target:
        return jsonify({'error': 'Comment not found'}), 404
    is_gm   = session.get('role') == 'gm'
    is_owner = target['authorUsername'] == session['username']
    if not is_owner and not is_gm:
        return jsonify({'error': 'Forbidden'}), 403

    target['deleted']   = True
    target['deletedBy'] = session['username']
    _write_comments(all_comments)
    is_gm = session.get('role') == 'gm'
    return jsonify({'ok': True, 'comment': _serialize_comment(target, is_gm)})


@app.route('/api/comments/<comment_id>/shred', methods=['POST'])
@gm_required
def api_shred_comment(comment_id):
    """GM only: permanently remove a comment."""
    err = _csrf_check()
    if err: return err
    all_comments = _read_comments()
    original_len = len(all_comments)
    all_comments = [c for c in all_comments if c['id'] != comment_id]
    if len(all_comments) == original_len:
        return jsonify({'error': 'Comment not found'}), 404
    _write_comments(all_comments)
    return jsonify({'ok': True, 'shredded': comment_id})


@app.route('/api/comments/<comment_id>/restore', methods=['POST'])
@login_required
def api_restore_comment(comment_id):
    """GM always; players may restore only if they deleted their own comment."""
    err = _csrf_check()
    if err: return err
    all_comments = _read_comments()
    target = next((c for c in all_comments if c['id'] == comment_id), None)
    if not target:
        return jsonify({'error': 'Comment not found'}), 404
    is_gm    = session.get('role') == 'gm'
    username = session['username']
    is_own   = target.get('authorUsername') == username
    deleted_by_self = target.get('deletedBy') == username
    if not is_gm and not (is_own and deleted_by_self):
        return jsonify({'error': 'Forbidden'}), 403
    target['deleted']   = False
    target['deletedBy'] = None
    _write_comments(all_comments)
    return jsonify({'ok': True, 'comment': _serialize_comment(target, is_gm)})


# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

def _read_notifications(username: str) -> list:
    """Returns notifications list (newest first)."""
    path = PLAYER_DATA_DIR / username / 'notifications.json'
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _push_notification(username: str, notif_type: str, text: str, link: str = '') -> None:
    """Append a notification to player_data/{username}/notifications.json. Cap at 100."""
    import secrets as _secrets
    d = PLAYER_DATA_DIR / username
    d.mkdir(parents=True, exist_ok=True)
    path = d / 'notifications.json'
    notifs = _read_notifications(username)
    notif = {
        'id':   'notif-' + _secrets.token_hex(6),
        'type': notif_type,
        'text': text,
        'link': link,
        'read': False,
        'ts':   datetime.utcnow().isoformat() + 'Z',
    }
    notifs.insert(0, notif)
    notifs = notifs[:100]
    _atomic_write(path, json.dumps(notifs, indent=2))


@app.route('/api/notifications')
@login_required
def api_get_notifications():
    """Any logged-in user: read own notifications (last 50, newest first)."""
    notifs = _read_notifications(session['username'])
    return jsonify({'notifications': notifs[:50]})


@app.route('/api/notifications/read', methods=['POST'])
@login_required
def api_mark_notifications_read():
    """Any logged-in user: mark notifications as read by id list or all."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    username = session['username']
    notifs   = _read_notifications(username)

    if data.get('all') is True:
        for n in notifs:
            n['read'] = True
    else:
        ids = data.get('ids')
        if not isinstance(ids, list):
            return jsonify({'error': 'Provide ids list or all:true'}), 400
        id_set = set(ids)
        for n in notifs:
            if n['id'] in id_set:
                n['read'] = True

    d = PLAYER_DATA_DIR / username
    d.mkdir(parents=True, exist_ok=True)
    _atomic_write(d / 'notifications.json', json.dumps(notifs, indent=2))
    return jsonify({'ok': True})


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _rotate_backup(save_path: Path) -> None:
    try:
        BACKUP_DIR.mkdir(exist_ok=True)
        stamp  = datetime.now().strftime('%Y%m%d_%H%M%S')
        target = BACKUP_DIR / f'binder-save_{stamp}.json'
        shutil.copy2(save_path, target)
        backups = sorted(BACKUP_DIR.glob('binder-save_*.json'))
        for old in backups[:-5]:
            old.unlink()
    except Exception as e:
        print(f'  [Backup] Warning: {e}')

# ── SAVE LOCK / RESTART FLAG ─────────────────────────────────────────────────
# Protects all file-write operations so a restart command never kills the
# process mid-write.  Console listener sets _restart_pending if a save is
# in progress; the save route checks it on exit and restarts then.

_save_lock       = threading.Lock()
_restart_pending = threading.Event()

# ── MULTIPLAYER STATE (in-memory) ────────────────────────────────────────────

_mp_lock     = threading.Lock()
_broadcasts  = []     # list of {id, message, timestamp, sender}
_submissions_lock = threading.Lock()
_presence    = {}     # username → {displayName, role, last_seen}


def _do_restart():
    import subprocess
    subprocess.Popen([sys.executable] + sys.argv)
    os._exit(0)


# ── CONSOLE LISTENER ─────────────────────────────────────────────────────────

def _console_listener():
    """Listen for console commands while the server is running."""
    COMMANDS = {
        'restart': 'Restart the server',
        'status':  'Show server status',
        'users':   'List user accounts',
        'help':    'Show this help',
    }
    while True:
        try:
            cmd = input().strip().lower()
        except EOFError:
            break

        if cmd == 'restart':
            if _save_lock.locked():
                _restart_pending.set()
                print('  [Console] Will restart once save is complete...')
            else:
                print('  [Console] Restarting server...')
                _do_restart()

        elif cmd == 'status':
            cfg  = load_config()
            path = cfg.get('saveFile', 'Not configured')
            use_https = CERT_FILE.exists() and KEY_FILE.exists() and SECRETS.get('FORCE_HTTP') != '1'
            print(f'  [Status] Save file : {path}')
            print(f'  [Status] HTTPS     : {"Yes" if use_https else "No"}')
            print(f'  [Status] API key   : {"Set" if SECRETS.get("ANTHROPIC_KEY") else "Not set"}')
            print(f'  [Status] Setup     : {"Needed" if needs_setup() else "Complete"}')

        elif cmd == 'users':
            for u in load_users():
                has_pw = '✓' if u.get('password_hash') else '✗'
                hh = f" ({u['household']})" if u.get('household') else ''
                print(f'  [Users]  {has_pw} {u["username"]}{hh} — {u["role"]}')

        elif cmd in ('help', '?'):
            print('  [Console] Available commands:')
            for name, desc in COMMANDS.items():
                print(f'    {name:<10} {desc}')

        elif cmd == '':
            pass  # ignore empty input

        else:
            print(f'  [Console] Unknown command: "{cmd}" — type "help" for options')


# ── STARTUP ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    os.chdir(BASE_DIR)

    # Ensure player data directory exists
    PLAYER_DATA_DIR.mkdir(exist_ok=True)

    # Create users.json if it doesn't exist
    if not USERS_FILE.exists():
        default_users = [
            {'username': 'Steve', 'role': 'gm',     'household': None,        'password_hash': None},
            {'username': 'Zerk',  'role': 'player',  'household': 'Blackwood', 'password_hash': None},
            {'username': 'Dan',   'role': 'player',  'household': 'Cador',     'password_hash': None},
            {'username': 'Rich',  'role': 'player',  'household': 'Dawnwell',  'password_hash': None},
            {'username': 'Tay',   'role': 'player',  'household': 'Westwood',  'password_hash': None},
        ]
        save_users(default_users)
        print('  [Setup] users.json created — visit /setup to set passwords.')

    ensure_certificate()

    cfg  = load_config()
    path = cfg.get('saveFile', 'Not configured')

    use_https = CERT_FILE.exists() and KEY_FILE.exists() and SECRETS.get('FORCE_HTTP') != '1'
    protocol  = 'https' if use_https else 'http'

    print()
    print('  ══════════════════════════════════════════')
    print("   Pendragon GM's Binder — Server Ready")
    print('  ══════════════════════════════════════════')
    print(f'  Address  : {protocol}://localhost:{PORT}')
    print(f'  Save file: {path}')
    print(f'  Backups  : {BACKUP_DIR.name}/ (last 5 kept)')
    if needs_setup():
        print(f'  NOTICE   : Visit {protocol}://localhost:{PORT}/setup to set passwords')
    print()
    print('  [Keep this window open while using the app]')
    print('  [Close this window when done]')
    print()

    ssl_context = None
    if use_https:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(str(CERT_FILE), str(KEY_FILE))

    # Start console command listener in background thread (interactive terminals only)
    if sys.stdin.isatty():
        threading.Thread(target=_console_listener, daemon=True).start()

    # Behind Cloudflare Tunnel, bind to localhost only — the tunnel handles
    # all external traffic. Change to '0.0.0.0' only if running without a tunnel.
    bind_host = '127.0.0.1' if _cf_tunnel else '0.0.0.0'
    app.run(host=bind_host, port=PORT, ssl_context=ssl_context, debug=False)
