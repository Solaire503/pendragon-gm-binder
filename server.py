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
from datetime import datetime
from functools import wraps
from pathlib import Path

from flask import (Flask, jsonify, redirect, render_template_string,
                   request, send_from_directory, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

# ── PATHS ────────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).parent.resolve()
CONFIG_FILE  = BASE_DIR / 'config.json'
SECRETS_FILE = BASE_DIR / 'secrets.env'
USERS_FILE   = BASE_DIR / 'users.json'
BACKUP_DIR   = BASE_DIR / 'backups'
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
# Mark cookies Secure when we're actually serving HTTPS. Disabled under
# FORCE_HTTP=1 because Secure cookies would never be sent over plain HTTP.
app.config['SESSION_COOKIE_SECURE'] = (SECRETS.get('FORCE_HTTP') != '1')

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

# ── USER MANAGEMENT ───────────────────────────────────────────────────────────

_users_lock = threading.Lock()

def load_users() -> list:
    with _users_lock:
        if not USERS_FILE.exists():
            return []
        return json.loads(USERS_FILE.read_text(encoding='utf-8'))

def save_users(users: list) -> None:
    with _users_lock:
        USERS_FILE.write_text(json.dumps(users, indent=2), encoding='utf-8')

def get_user(username: str) -> dict | None:
    for u in load_users():
        if u['username'].lower() == username.lower():
            return u
    return None

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
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding='utf-8')

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
    <input type="password" name="new" autocomplete="new-password" required minlength="6">
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
                if len(pw) < 6:
                    error = f"Password for {user['username']} must be at least 6 characters."
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
        ip = request.remote_addr
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

    cfg = load_config()
    year = 498  # fallback; real year lives in the save file
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
        elif len(new_pw) < 6:
            error = "New passphrase must be at least 6 characters."
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
        data = request.get_json(force=True)
        cfg  = load_config()

        if 'saveFile' in data:
            path = data['saveFile'].strip()
            if not path:
                return jsonify({'error': 'No path provided'}), 400
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
@login_required
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


@app.route('/api/save', methods=['POST'])
@gm_required
def api_save():
    try:
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
            path.write_text(body, encoding='utf-8')

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


@app.route('/api/new', methods=['POST'])
@gm_required
def api_new():
    try:
        data = request.get_json(force=True)
        raw  = data.get('saveFile', '').strip()
        if not raw:
            return jsonify({'error': 'No path'}), 400
        path = Path(raw)
        path.parent.mkdir(parents=True, exist_ok=True)
        empty = json.dumps({'version': 1, 'year': 498,
                            'living': [], 'dead': [], 'households': [],
                            'manors': {}, 'relationships': [], 'treePos': {}})
        path.write_text(empty, encoding='utf-8')
        cfg = load_config()
        cfg['saveFile'] = str(path)
        save_config(cfg)
        print(f'  [New]   Created {path}')
        return jsonify({'ok': True, 'saveFile': str(path)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai', methods=['POST'])
@gm_required
def api_ai():
    """Proxy to Anthropic API. GM only."""
    api_key = SECRETS.get('ANTHROPIC_KEY', '').strip()
    if not api_key:
        return jsonify({'error': 'No Anthropic API key configured'}), 400

    body = request.get_data()
    if not body:
        return jsonify({'error': 'Empty request body'}), 400

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
    """GM only — exposes filesystem."""
    drives = []
    for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        p = Path(f'{letter}:/')
        try:
            if p.exists():
                drives.append({'label': f'{letter}:\\', 'path': str(p)})
        except Exception:
            pass
    return jsonify({'base_dir': str(BASE_DIR), 'drives': drives})


@app.route('/api/succession', methods=['POST'])
@login_required
def api_succession():
    """Player Knight succession — players may act on their own household only."""
    data    = request.get_json(force=True)
    user_hh = session.get('household', '').lower()
    is_gm   = session.get('role') == 'gm'

    path = get_save_path()
    if not path or not path.exists():
        return jsonify({'error': 'No save file configured'}), 400

    save_data = json.loads(path.read_text(encoding='utf-8'))
    living    = save_data.get('living', [])
    dead      = save_data.get('dead', [])

    old_pk_id  = data.get('old_pk_id')
    new_pk_id  = data.get('new_pk_id')
    old_action = data.get('old_action')   # 'died' | 'retired' | 'na'
    life_event = data.get('life_event')   # dict for retired
    death_data = data.get('death_data')   # dict for died

    def hh_of(npc_id, pool):
        npc = next((n for n in pool if n.get('id') == npc_id), None)
        return (npc.get('household') or '').lower() if npc else None

    # Players may only act on their own household.
    # new_pk_id is always validated — a request with no old_pk_id must still
    # not be able to promote an NPC from a different household.
    if not is_gm:
        if not new_pk_id:
            return jsonify({'error': 'new_pk_id is required'}), 400
        for npc_id in filter(None, [old_pk_id, new_pk_id]):
            hh = hh_of(npc_id, living)
            if hh is None:
                return jsonify({'error': 'NPC not found'}), 404
            if hh != user_hh:
                return jsonify({'error': 'Forbidden'}), 403

    ts = int(datetime.now().timestamp() * 1000)

    # Handle old PK
    if old_action == 'died' and old_pk_id and death_data:
        idx = next((i for i, n in enumerate(living) if n.get('id') == old_pk_id), None)
        if idx is not None:
            npc = living.pop(idx)
            npc['status']        = 'Dead'
            npc['year_died']     = death_data.get('year', save_data.get('year', 499))
            cause = death_data.get('cause', '')
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
                        'title':       life_event.get('title', 'Retired from Questing'),
                        'mechDesc':    life_event.get('mechDesc', ''),
                        'flavorText':  None,
                        'userNotes':   life_event.get('userNotes', ''),
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

    with _save_lock:
        if path.exists():
            _rotate_backup(path)
        path.write_text(json.dumps(save_data, indent=2, ensure_ascii=False), encoding='utf-8')

    if _restart_pending.is_set():
        print('  [Console] Save complete — restarting now...')
        threading.Thread(target=_do_restart, daemon=True).start()

    return jsonify({'ok': True})


@app.route('/api/browse')
@gm_required
def api_browse():
    """GM only — filesystem browser for save file picker."""
    try:
        req_path = request.args.get('path', '').strip() or str(BASE_DIR)
        p = Path(req_path)
        if not p.exists() or not p.is_dir():
            p = Path.home()

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

    # Start console command listener in background thread
    threading.Thread(target=_console_listener, daemon=True).start()

    app.run(host='0.0.0.0', port=PORT, ssl_context=ssl_context, debug=False)
