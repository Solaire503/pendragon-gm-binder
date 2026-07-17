"""
Pendragon GM's Binder — Flask Server
Handles auth, sessions, role-based access, and all API endpoints.
"""

import copy
import hmac
import json
import logging
import os
import shutil
import smtplib
import secrets as _secrets_mod
import ssl
import sys
import threading
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
import re
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from functools import wraps
from pathlib import Path

from flask import (Flask, jsonify, redirect, render_template_string,
                   request, send_from_directory, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

# ── LOGGING ──────────────────────────────────────────────────────────────────
# Structured event logger. Goes to stdout under systemd, captured by journald.
# Interactive console output (banner, status, console listener) still uses print().
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-7s  %(message)s',
    datefmt='%H:%M:%S',
)
# Flask/Werkzeug's request log is noisy; keep it at WARNING for the event log.
logging.getLogger('werkzeug').setLevel(logging.WARNING)
log = logging.getLogger('pendragon')

# ── PATHS ────────────────────────────────────────────────────────────────────

APP_VERSION  = '3.9.3'  # keep in sync with js/app.js
BASE_DIR     = Path(__file__).parent.resolve()
CONFIG_FILE  = BASE_DIR / 'config.json'
SECRETS_FILE = BASE_DIR / 'secrets.env'
USERS_FILE   = BASE_DIR / 'users.json'
BACKUP_DIR   = BASE_DIR / 'backups'
PLAYER_DATA_DIR  = BASE_DIR / 'player_data'
SUBMISSIONS_FILE     = BASE_DIR / 'submissions.json'
BROADCAST_TASKS_FILE = BASE_DIR / 'broadcast_tasks.json'
BATTLE_FILE          = BASE_DIR / 'battle-state.json'
ARCS_FILE            = BASE_DIR / 'arcs.json'
SESSION_PREP_FILE    = BASE_DIR / 'session-prep.json'
CERT_FILE    = BASE_DIR / 'cert.pem'
KEY_FILE     = BASE_DIR / 'key.pem'
PORT         = 8765

# Files that must never be served to the browser
BLOCKED_FILES = {
    'secrets.env', 'users.json', 'cert.pem', 'key.pem',
    'cert.pem.bak', 'key.pem.bak',
    'config.json', '.env', 'server.py',
}
# Any file whose name ends with one of these suffixes is also blocked
BLOCKED_SUFFIXES = ('.pem', '.pem.bak', '.key', '.py', '.json')

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
BOT_KEY = SECRETS.get('BOT_KEY', '')
MCP_KEY = SECRETS.get('MCP_KEY', '')

_reset_tokens: dict = {}   # token -> {'username': str, 'expires': float}
_reset_tokens_lock = threading.Lock()

# ── PASSWORD POLICY ───────────────────────────────────────────────────────────

_COMMON_PASSWORDS = {
    'password','passphrase','password1','password123','123456789','1234567890',
    'qwerty','qwerty123','letmein','welcome','monkey','dragon','master',
    'sunshine','princess','shadow','superman','iloveyou','trustno1',
    'admin','login','hello','whatever','nothing','abc123','pass1234',
    'pendragon','binder','caliburn','arthur','merlin','lancelot','guinevere',
}

def _check_password_policy(password: str, current_hash: str | None = None) -> str | None:
    """Return an error string if the password fails policy, else None."""
    if len(password) < 10:
        return 'Passphrase must be at least 10 characters.'
    if password.lower() in _COMMON_PASSWORDS:
        return 'That passphrase is too common — choose something more memorable.'
    if current_hash and check_password_hash(current_hash, password):
        return 'New passphrase must be different from your current one.'
    return None

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
_login_attempts_lock = threading.Lock()
MAX_ATTEMPTS   = 5
WINDOW_SECONDS = 300   # 5-minute window

def _is_rate_limited(ip: str) -> bool:
    with _login_attempts_lock:
        now = time.time()
        attempts = [t for t in _login_attempts.get(ip, []) if now - t < WINDOW_SECONDS]
        _login_attempts[ip] = attempts
        return len(attempts) >= MAX_ATTEMPTS

def _record_attempt(ip: str) -> None:
    with _login_attempts_lock:
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
    with _login_attempts_lock:
        _login_attempts.pop(ip, None)

# ── CSRF PROTECTION ───────────────────────────────────────────────────────────

def _csrf_check():
    """Verify that state-changing requests originate from this app's own origin.

    Strategy (in order):
    1. Block observer accounts — they are always read-only.
    2. Compare Origin header to Host — the standard check for fetch/XHR.
    3. If no Origin, compare Referer to Host — fallback for same-origin POSTs
       where some browsers omit Origin.
    4. If neither header is present, reject the request outright.

    The old localhost bypass is intentionally removed: behind Cloudflare Tunnel
    every request arrives from 127.0.0.1, which would skip all CSRF checks.
    Modern browsers always include Origin or Referer on same-origin POSTs.
    """
    if session.get('role') == 'observer':
        return jsonify({'error': 'Observer accounts are read-only'}), 403

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

def _session_valid():
    """Check that the session nonce matches the user's current nonce."""
    if 'username' not in session:
        return False
    user = get_user(session['username'])
    if not user:
        return False
    if session.get('nonce') != user.get('session_nonce', ''):
        session.clear()
        return False
    return True

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _session_valid():
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Not authenticated'}), 401
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated

def gm_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _session_valid():
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'gm':
            return jsonify({'error': 'Forbidden'}), 403
        live_user = get_user(session['username'])
        if not live_user or live_user.get('role') != 'gm':
            return jsonify({'error': 'Forbidden'}), 403
        return f(*args, **kwargs)
    return decorated

def bot_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not BOT_KEY or not hmac.compare_digest(auth, f'Bearer {BOT_KEY}'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

def mcp_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not MCP_KEY or not hmac.compare_digest(auth, f'Bearer {MCP_KEY}'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

def _auth_gm_or_mcp_read():
    auth = request.headers.get('Authorization', '')
    if auth and MCP_KEY and hmac.compare_digest(auth, f'Bearer {MCP_KEY}'):
        return None
    if not _session_valid():
        return jsonify({'error': 'Not authenticated'}), 401
    if session.get('role') != 'gm':
        return jsonify({'error': 'Forbidden'}), 403
    live_user = get_user(session['username'])
    if not live_user or live_user.get('role') != 'gm':
        return jsonify({'error': 'Forbidden'}), 403
    return None

def _auth_gm_or_mcp():
    auth = request.headers.get('Authorization', '')
    if auth and MCP_KEY and hmac.compare_digest(auth, f'Bearer {MCP_KEY}'):
        return None
    if not _session_valid():
        return jsonify({'error': 'Not authenticated'}), 401
    if session.get('role') != 'gm':
        return jsonify({'error': 'Forbidden'}), 403
    live_user = get_user(session['username'])
    if not live_user or live_user.get('role') != 'gm':
        return jsonify({'error': 'Forbidden'}), 403
    return _csrf_check()

# ── SECURITY HEADERS ──────────────────────────────────────────────────────────

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options']        = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy']        = 'same-origin'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self';"
    )
    return response

# ── ATOMIC FILE WRITES ────────────────────────────────────────────────────────

def _atomic_write(path: Path, text: str) -> None:
    """Write text to a file atomically: write to .tmp then rename.
    os.replace() is atomic on Linux — no partial/truncated files on crash."""
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(text, encoding='utf-8')
    os.replace(str(tmp), str(path))

def _read_json(path: Path, default=None):
    """Read and parse a JSON file. Returns ``default`` on missing file or parse error.
    Callers that need strict error handling should still use ``json.loads`` directly."""
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        log.warning('JSON read failed for %s: %s', path.name, e)
        return default

def _write_json(path: Path, data, indent: int = 2) -> None:
    """Serialize data to JSON and write atomically. Creates parent dirs as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(path, json.dumps(data, indent=indent, ensure_ascii=False))

# ── USER MANAGEMENT ───────────────────────────────────────────────────────────

_users_lock = threading.RLock()

def load_users() -> list:
    with _users_lock:
        return _read_json(USERS_FILE, default=[]) or []

def save_users(users: list) -> None:
    with _users_lock:
        _write_json(USERS_FILE, users)
        USERS_FILE.chmod(0o600)

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
    return _read_json(PLAYER_DATA_DIR / username / 'horses.json', default=[]) or []

def _write_horses(username: str, horses: list) -> None:
    _write_json(PLAYER_DATA_DIR / username / 'horses.json', horses)

def needs_setup() -> bool:
    """True if any user account has no password set yet."""
    users = load_users()
    if not users:
        return True
    return any(not u.get('password_hash') for u in users)

# ── CONFIG ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    return _read_json(CONFIG_FILE, default={}) or {}

def save_config(cfg: dict) -> None:
    _write_json(CONFIG_FILE, cfg)

def load_submissions():
    return _read_json(SUBMISSIONS_FILE, default=[]) or []

def save_submissions_data(subs):
    _write_json(SUBMISSIONS_FILE, subs)

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
    log.info('[SSL] Generating self-signed certificate (one-time)...')
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
        log.info('[SSL] Certificate written to cert.pem / key.pem')
    except Exception as e:
        log.warning('[SSL] Could not generate certificate: %s', e)
        log.warning('[SSL] Server will start without HTTPS.')

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
    <div style="position:relative;">
      <input type="password" id="loginPw" name="password" autocomplete="current-password" required style="padding-right:40px;width:100%;box-sizing:border-box;">
      <button type="button" onclick="var i=document.getElementById('loginPw');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈';" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;opacity:0.6;">👁</button>
    </div>
    <button class="btn" type="submit">Enter the Hall</button>
  </form>
  <div style="margin-top:16px;text-align:center;font-size:0.82rem;">
    <a href="/forgot-password" style="color:var(--ink-soft);text-decoration:underline;">Forgot your passphrase?</a>
  </div>
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

FORGOT_HTML = """<!DOCTYPE html><html lang="en"><head>""" + _BASE_STYLE + """
<title>Pendragon — Reset Passphrase</title>
</head><body>
<div class="card">
  <div class="crest">🗝</div>
  <h1>Reset Passphrase</h1>
  <div class="subtitle">Enter your email address</div>
  {% if message %}<div class="info">{{ message }}</div>{% endif %}
  <form id="forgotForm">
    <label>Email Address</label>
    <input type="email" id="emailInput" required autocomplete="email" autofocus>
    <button class="btn" type="submit">Send Reset Link</button>
  </form>
  <hr class="divider">
  <div class="footer-link"><a href="/login">Back to sign in</a></div>
</div>
<script>
document.getElementById('forgotForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button');
  btn.disabled = true;
  const r = await fetch('/api/forgot-password', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({email: document.getElementById('emailInput').value})
  });
  const d = await r.json();
  const el = document.querySelector('.card');
  let info = el.querySelector('.info');
  if (!info) { info = document.createElement('div'); info.className='info'; el.insertBefore(info, el.querySelector('form')); }
  info.textContent = d.message || 'If that email is registered, a reset link has been sent.';
  btn.disabled = false;
});
</script>
</body></html>
"""

RESET_HTML = """<!DOCTYPE html><html lang="en"><head>""" + _BASE_STYLE + """
<title>Pendragon — Set New Passphrase</title>
</head><body>
<div class="card">
  <div class="crest">🗝</div>
  <h1>Set New Passphrase</h1>
  <div class="subtitle">Choose a passphrase (10+ characters)</div>
  {% if error %}<div class="error">{{ error }}</div>{% endif %}
  <form id="resetForm">
    <label>New Passphrase</label>
    <div style="position:relative;">
      <input type="password" id="pw1" required autocomplete="new-password" minlength="10" style="padding-right:40px;width:100%;box-sizing:border-box;">
      <button type="button" onclick="var i=document.getElementById('pw1');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈';" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;opacity:0.6;">👁</button>
    </div>
    <label>Confirm New Passphrase</label>
    <div style="position:relative;">
      <input type="password" id="pw2" required autocomplete="new-password" style="padding-right:40px;width:100%;box-sizing:border-box;">
      <button type="button" onclick="var i=document.getElementById('pw2');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈';" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;opacity:0.6;">👁</button>
    </div>
    <button class="btn" type="submit">Set Passphrase</button>
  </form>
</div>
<script>
document.getElementById('resetForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const pw1 = document.getElementById('pw1').value;
  const pw2 = document.getElementById('pw2').value;
  const card = document.querySelector('.card');
  let err = card.querySelector('.error');
  if (!err) { err = document.createElement('div'); err.className='error'; card.insertBefore(err, card.querySelector('form')); }
  if (pw1 !== pw2) { err.textContent = 'Passphrases do not match.'; err.hidden = false; return; }
  const btn = this.querySelector('button');
  btn.disabled = true;
  const r = await fetch(location.pathname.replace('/reset/', '/api/reset/'), {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({password: pw1})
  });
  const d = await r.json();
  if (d.ok) {
    card.innerHTML = '<div class="crest">✔</div><h1>Passphrase Set</h1><div class="subtitle">You can now sign in.</div><hr class="divider"><div class="footer-link"><a href="/login">Sign in</a></div>';
  } else {
    err.textContent = d.error || 'Something went wrong.';
    err.hidden = false;
    btn.disabled = false;
  }
});
</script>
</body></html>
"""

RESET_INVALID_HTML = """<!DOCTYPE html><html lang="en"><head>""" + _BASE_STYLE + """
<title>Pendragon — Invalid Link</title>
</head><body>
<div class="card">
  <div class="crest">⚠</div>
  <h1>Invalid or Expired Link</h1>
  <div class="subtitle">This reset link is no longer valid.</div>
  <hr class="divider">
  <div class="footer-link"><a href="/forgot-password">Request a new link</a></div>
</div>
</body></html>
"""


def _send_reset_email(to_addr: str, token: str, base_url: str) -> bool:
    smtp_user = SECRETS.get('SMTP_USER', '')
    smtp_pass = SECRETS.get('SMTP_PASS', '')
    if not smtp_user or not smtp_pass:
        return False
    reset_url = f"{base_url}/reset/{token}"
    body = f"""Hello,

Someone requested a password reset for your Pendragon GM's Binder account.

Click the link below to set a new password (valid for 1 hour):
{reset_url}

If you didn't request this, you can safely ignore this email.

— The Binder
"""
    msg = MIMEText(body)
    msg['Subject'] = "Pendragon Binder \u2014 Password Reset"
    msg['From']    = smtp_user
    msg['To']      = to_addr
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
            s.login(smtp_user, smtp_pass.replace(' ', ''))
            s.send_message(msg)
        return True
    except Exception:
        return False

# ── ROUTES: AUTH ──────────────────────────────────────────────────────────────

@app.route('/setup', methods=['GET', 'POST'])
def setup():
    if request.remote_addr not in ('127.0.0.1', '::1'):
        return jsonify({'error': 'Setup only accessible from localhost'}), 403
    if _cf_tunnel and load_users():
        return jsonify({'error': 'Setup disabled while tunnel is active'}), 403
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
                nonce = _secrets_mod.token_urlsafe(16)
                session.clear()
                session.permanent    = True   # enables PERMANENT_SESSION_LIFETIME
                session['username']  = user['username']
                session['role']      = user['role']
                session['household'] = user.get('household')
                session['nonce']     = nonce
                with _users_lock:
                    users = load_users()
                    for u in users:
                        if u['username'].lower() == username.lower():
                            u['lastLogin'] = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z'
                            u['session_nonce'] = nonce
                            break
                    save_users(users)
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


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/forgot-password')
def forgot_password():
    return render_template_string(FORGOT_HTML, message=None)


@app.route('/api/forgot-password', methods=['POST'])
def api_forgot_password():
    ip = request.headers.get('CF-Connecting-IP') or request.remote_addr or 'unknown'
    if _is_rate_limited(f'reset:{ip}'):
        return jsonify({'ok': True, 'message': 'If that email is registered, a reset link has been sent.'}), 200
    _record_attempt(f'reset:{ip}')
    data  = request.get_json(force=True, silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    users = load_users()
    matched = next((u for u in users if (u.get('email') or '').strip().lower() == email), None)
    if matched and email:
        token = _secrets_mod.token_urlsafe(32)
        with _reset_tokens_lock:
            _reset_tokens[token] = {'username': matched['username'], 'expires': time.time() + 3600}
        if SECRETS.get('CF_TUNNEL'):
            base_url = 'https://pendragon-binder.com'
        else:
            base_url = request.host_url.rstrip('/')
        threading.Thread(
            target=_send_reset_email,
            args=(matched['email'], token, base_url),
            daemon=True,
        ).start()
    return jsonify({'ok': True, 'message': 'If that email is registered, a reset link has been sent.'})


@app.route('/reset/<token>')
def reset_password_page(token):
    with _reset_tokens_lock:
        entry = _reset_tokens.get(token)
    if not entry or entry['expires'] < time.time():
        return render_template_string(RESET_INVALID_HTML)
    return render_template_string(RESET_HTML, error=None)


@app.route('/api/reset/<token>', methods=['POST'])
def api_reset_password(token):
    with _reset_tokens_lock:
        entry = _reset_tokens.get(token)
    if not entry or entry['expires'] < time.time():
        return jsonify({'error': 'Invalid or expired reset link.'}), 400
    data     = request.get_json(force=True, silent=True) or {}
    password = data.get('password', '')
    with _users_lock:
        users = load_users()
        current_hash = next((u['password_hash'] for u in users if u['username'].lower() == entry['username'].lower()), None)
        policy_err = _check_password_policy(password, current_hash)
        if policy_err:
            return jsonify({'error': policy_err}), 400
        for u in users:
            if u['username'].lower() == entry['username'].lower():
                u['password_hash'] = generate_password_hash(password)
                u['session_nonce'] = _secrets_mod.token_urlsafe(16)
                break
        save_users(users)
    with _reset_tokens_lock:
        _reset_tokens.pop(token, None)
        expired = [t for t, v in _reset_tokens.items() if v['expires'] < time.time()]
        [_reset_tokens.pop(t) for t in expired]
    return jsonify({'ok': True})


@app.route('/account', methods=['GET', 'POST'])
@login_required
def account():
    error = None
    success = None

    if request.method == 'POST':
        err = _csrf_check()
        if err: return err
        current = request.form.get('current', '')
        new_pw  = request.form.get('new', '').strip()
        confirm = request.form.get('confirm', '').strip()

        user = get_user(session['username'])
        if not user or not check_password_hash(user['password_hash'], current):
            error = "Current passphrase is incorrect."
        elif new_pw != confirm:
            error = "New passphrases do not match."
        else:
            error = _check_password_policy(new_pw, user.get('password_hash'))
        if not error:
            new_nonce = _secrets_mod.token_urlsafe(16)
            with _users_lock:
                users = load_users()
                for u in users:
                    if u['username'].lower() == session['username'].lower():
                        u['password_hash'] = generate_password_hash(new_pw)
                        u['session_nonce'] = new_nonce
                        break
                save_users(users)
            session['nonce'] = new_nonce
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
        f'document.documentElement.classList.add(r==="gm"?"is-gm":r==="observer"?"is-observer":"is-player")}})()</script>\n'
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
    """Return current user info for the frontend. Stamps lastLogin at most
    once per 60 seconds so persistent sessions stay current without hammering
    users.json on every page load."""
    with _users_lock:
        users = load_users()
        user  = None
        dirty = False
        now   = datetime.now(timezone.utc).replace(tzinfo=None)
        for u in users:
            if u['username'].lower() == session['username'].lower():
                user = u
                prev = u.get('lastLogin', '')
                try:
                    prev_dt = datetime.strptime(prev, '%Y-%m-%dT%H:%M:%S.%fZ')
                except (ValueError, TypeError):
                    prev_dt = None
                if prev_dt is None or (now - prev_dt).total_seconds() > 60:
                    u['lastLogin'] = now.isoformat() + 'Z'
                    dirty = True
                break
        if dirty:
            save_users(users)
    return jsonify({
        'username':  session['username'],
        'role':      session['role'],
        'household': session.get('household'),
        'hasEmail':  bool(user and user.get('email')),
    })


@app.route('/api/me/email', methods=['PATCH'])
@login_required
def api_set_my_email():
    err = _csrf_check()
    if err: return err
    data  = request.get_json(force=True, silent=True) or {}
    email = data.get('email', '').strip().lower()
    if not email or '@' not in email or '.' not in email.split('@')[-1]:
        return jsonify({'error': 'Please enter a valid email address.'}), 400
    with _users_lock:
        users = load_users()
        for u in users:
            if u['username'].lower() == session['username'].lower():
                u['email'] = email
                break
        save_users(users)
    return jsonify({'ok': True})


@app.route('/api/keep-alive', methods=['POST'])
@login_required
def api_keep_alive():
    """Extend the session lifetime. Called by the client-side idle warning."""
    err = _csrf_check()
    if err: return err
    session.modified = True
    with _users_lock:
        users = load_users()
        for u in users:
            if u['username'].lower() == session['username'].lower():
                u['lastLogin'] = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z'
                break
        save_users(users)
    return jsonify({'ok': True})


@app.route('/api/config', methods=['GET'])
@login_required
def api_get_config():
    cfg  = load_config()
    path = cfg.get('saveFile')
    return jsonify({
        'saveFile':   os.path.basename(path) if path else '',
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
            log.info('[Config] Save file set to: %s', path)

        # anthropicKey changes via UI are ignored — key lives in secrets.env
        if 'anthropicKey' in data:
            log.info('[Config] API key change via UI ignored — edit secrets.env directly.')

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
        return jsonify({'status': 'file_missing', 'path': path.name})
    try:
        data = path.read_text(encoding='utf-8')
        json.loads(data)  # validate
        log.info('[Load] %s (%s bytes)', path.name, f'{len(data):,}')
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
        return jsonify({'status': 'file_missing'})
    try:
        data = path.read_text(encoding='utf-8')
        binder = json.loads(data)
        # Strip GM-only fields from every NPC before sending to players —
        # except NPCs in the player's own household, whose notes/skills/
        # passions/stats stay visible (and editable, see /api/npc PATCH).
        _GM_NPC_FIELDS = {'stats', 'passions', 'skills', 'notes', 'statblock_template'}
        user_hh = (session.get('household') or '').lower()

        def _strip(npc):
            if not isinstance(npc, dict):
                return
            if user_hh and (npc.get('household') or '').lower() == user_hh:
                npc.pop('statblock_template', None)
                return
            for f in _GM_NPC_FIELDS:
                npc.pop(f, None)

        for key in ('living', 'dead'):
            npc_list = binder.get(key, [])
            if isinstance(npc_list, list):
                for npc in npc_list:
                    _strip(npc)
            elif isinstance(npc_list, dict):
                for npc in npc_list.values():
                    _strip(npc)
        return app.response_class(json.dumps(binder), mimetype='application/json')
    except Exception:
        return jsonify({'error': 'Failed to load save data'}), 500


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
            # Merge: preserve any relationships saved by players via /api/relationships
            # since the GM's in-memory copy may be stale relative to the on-disk version.
            if path.exists():
                _rotate_backup(path)
                try:
                    disk_binder = json.loads(path.read_text(encoding='utf-8'))
                    gm_binder   = json.loads(body)
                    disk_rels = disk_binder.get('relationships', [])
                    gm_rels   = gm_binder.get('relationships', [])
                    # GM's copy is authoritative — start from it, keyed by rel id.
                    merged_by_id = {r.get('id'): r for r in gm_rels if isinstance(r, dict) and r.get('id')}
                    # Layer in any player-saved rels from disk that the GM doesn't have.
                    for r in disk_rels:
                        if not isinstance(r, dict):
                            continue
                        rid = r.get('id')
                        if rid and rid not in merged_by_id:
                            merged_by_id[rid] = r
                    gm_binder['relationships'] = list(merged_by_id.values())
                    body = json.dumps(gm_binder, ensure_ascii=False)
                except Exception as e:
                    log.warning('[Save] Relationship merge failed: %s', e)
            _atomic_write(path, body)

        now = datetime.now().strftime('%H:%M:%S')
        log.info('[Save] %s — %s bytes at %s', path.name, f'{len(body):,}', now)

        if _restart_pending.is_set():
            log.info('[Restart] Save complete — restarting now...')
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
        except Exception:
            return jsonify({'error': 'Failed to read save data'}), 500

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

        _rotate_backup(path)
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
        log.info('[New] Created %s', path)
        return jsonify({'ok': True, 'saveFile': str(path)})
    except Exception as e:
        return jsonify({'error': 'Could not create save file'}), 500


def _validate_ai_messages(messages) -> list:
    """Validate and sanitize messages array for Anthropic API proxy."""
    if not isinstance(messages, list):
        raise ValueError('messages must be a list')
    if len(messages) > 10:
        raise ValueError('Too many messages (max 10)')
    clean = []
    for m in messages:
        if not isinstance(m, dict):
            raise ValueError('Each message must be an object')
        role = m.get('role', '')
        content = m.get('content', '')
        if role not in ('user', 'assistant'):
            raise ValueError(f'Invalid role: {role}')
        if isinstance(content, str):
            if len(content) > 10000:
                raise ValueError('Message content too long (max 10000 chars)')
        elif isinstance(content, list):
            total = sum(len(str(c.get('text', ''))) for c in content if isinstance(c, dict))
            if total > 10000:
                raise ValueError('Message content too long (max 10000 chars)')
        else:
            raise ValueError('Message content must be string or list')
        clean.append({'role': role, 'content': content})
    return clean


@app.route('/api/ai', methods=['POST'])
@gm_required
def api_ai():
    """Proxy to Anthropic API. GM only.
    Only forwards specific safe fields — prevents model/token abuse via
    a stolen GM session or crafted request body."""
    err = _csrf_check()
    if err: return err
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
            'messages':   _validate_ai_messages(raw.get('messages', [])),
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
            log.info('[AI] Flavor text generated')
            return app.response_class(resp_body, status=r.status, mimetype='application/json')
    except urllib.error.HTTPError as e:
        log.error('[AI] API error: %s', e.code)
        return jsonify({'error': 'AI service returned an error'}), e.code
    except Exception as e:
        log.error('[AI] Error: %s', e)
        return jsonify({'error': 'AI request failed'}), 500


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

        # Update manor + household to reflect succession
        if new_pk_id:
            new_npc = next((n for n in living if n.get('id') == new_pk_id), None)
            if new_npc:
                new_hh = (new_npc.get('household') or '').strip()
                for mkey, manor in save_data.get('manors', {}).items():
                    if mkey.lower() == new_hh.lower():
                        manor['lord_id'] = new_pk_id
                        name = new_npc.get('name', '')
                        pronoun = (new_npc.get('pronoun') or '').lower()
                        title = 'Dame' if pronoun.startswith('she') else 'Sir'
                        if not name.startswith('Sir ') and not name.startswith('Dame '):
                            name = f'{title} {name}'
                        manor['knight'] = name
                        if manor.get('heir_id') == new_pk_id:
                            manor['heir_id'] = None
                        break
                for hh in save_data.get('households', []):
                    if (hh.get('name') or '').lower() == new_hh.lower():
                        hh['household_head'] = new_pk_id
                        break

        save_data['living'] = living
        save_data['dead']   = dead

        if path.exists():
            _rotate_backup(path)
        _atomic_write(path, json.dumps(save_data, indent=2, ensure_ascii=False))

    if _restart_pending.is_set():
        log.info('[Restart] Save complete — restarting now...')
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
        'id':        'bc_' + _secrets_mod.token_hex(8),
        'message':   msg,
        'timestamp': time.time(),
        'sender':    session['username'],
    }
    with _mp_lock:
        _broadcasts.append(entry)
        if len(_broadcasts) > 20:
            _broadcasts[:] = _broadcasts[-20:]

    log.info('[Broadcast] %s: %s', session['username'], msg[:60])
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
        'id':             'sub_' + _secrets_mod.token_hex(8),
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
        # Cap at 200 entries, keeping most recent
        if len(subs) > 200:
            subs = subs[-200:]
        save_submissions_data(subs)
    log.info('[Submit] %s submitted chronicle entry for %s AD', session['username'], year)
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
    log.info('[Chronicle] GM approved submission %s for %s AD', sub_id, year_key)
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
    err = _csrf_check()
    if err: return err
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


_HORSE_TYPES = {
    'Hobby', 'Charger (Small)', 'Charger (Normal)', 'Destrier', 'Fairy Horse',
    'Jennet', 'Rouncey (Inferior)', 'Rouncy (Small)', 'Rouncy (Normal)',
    'Rouncy (Large)', 'Courser', 'Dales/Irish/Cambrian Pony',
    'Cart Horse', 'Cob', 'Nag', 'Sumpter', 'Sumpter (Strong)',
    'Hackney', 'Donkey', 'Mule',
}
_HORSE_ALLOWED_FIELDS = {
    'id', 'name', 'type', 'year_born', 'year_acquired', 'rider',
    'notes', 'alive', 'year_died', 'death_reason', 'favorite', 'survivalHistory',
}

def _validate_horses(raw: list):
    """Validate and sanitise a list of horse dicts. Returns (clean_list, error_str)."""
    if len(raw) > 200:
        return None, 'Too many horses (max 200)'
    out = []
    for i, h in enumerate(raw):
        if not isinstance(h, dict):
            return None, f'Entry {i} is not an object'
        name = h.get('name')
        if not isinstance(name, str) or not name.strip():
            return None, f'Entry {i}: name is required and must be a non-empty string'
        htype = h.get('type')
        if htype not in _HORSE_TYPES:
            return None, f'Entry {i}: invalid type "{htype}"'
        clean = {k: v for k, v in h.items() if k in _HORSE_ALLOWED_FIELDS}
        clean['name'] = clean['name'][:80]
        if 'notes' in clean and isinstance(clean['notes'], str):
            clean['notes'] = clean['notes'][:200]
        if 'rider' in clean and isinstance(clean['rider'], str):
            clean['rider'] = clean['rider'][:200]
        if 'age' in clean:
            age = clean['age']
            if not isinstance(age, int) or not (0 <= age <= 40):
                return None, f'Entry {i}: age must be an integer 0–40'
        out.append(clean)
    return out, None

@app.route('/api/horses', methods=['POST'])
@login_required
def api_save_horses():
    """Player: save own horses."""
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('horses'), list):
        return jsonify({'error': 'Invalid payload'}), 400
    horses, err_msg = _validate_horses(data['horses'])
    if err_msg:
        return jsonify({'error': err_msg}), 400
    _write_horses(session['username'], horses)
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
    horses, err_msg = _validate_horses(data['horses'])
    if err_msg:
        return jsonify({'error': err_msg}), 400
    _write_horses(username, horses)
    return jsonify({'ok': True})


# ── PER-USER LOCK (protects pins, notes, notifications for each user) ────────

_player_locks: dict = {}
_player_locks_lock = threading.Lock()

def _player_lock(username: str) -> threading.Lock:
    with _player_locks_lock:
        if username not in _player_locks:
            _player_locks[username] = threading.Lock()
        return _player_locks[username]

# ── PINS ─────────────────────────────────────────────────────────────────────

def _read_pins(username: str) -> list:
    return _read_json(PLAYER_DATA_DIR / username / 'pins.json', default=[]) or []


def _write_pins(username: str, pins: list) -> None:
    _write_json(PLAYER_DATA_DIR / username / 'pins.json', pins)


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
    raw_pins = data['pins']
    if len(raw_pins) > 100:
        return jsonify({'error': 'Too many pins (max 100)'}), 400
    pins = []
    for i, p in enumerate(raw_pins):
        if not isinstance(p, str) or not p:
            return jsonify({'error': f'Pin {i} must be a non-empty string'}), 400
        if len(p) > 60:
            return jsonify({'error': f'Pin {i} exceeds max length of 60 characters'}), 400
        pins.append(p)
    with _player_lock(session['username']):
        _write_pins(session['username'], pins)
    return jsonify({'ok': True})


# ── TASKS & REMINDERS ─────────────────────────────────────────────────────────

_broadcast_tasks_lock = threading.Lock()
_TASK_TEXT_MAX    = 500
_PERSONAL_TASKS_MAX = 100


def _read_personal_tasks(username: str) -> list:
    """Load tasks.json for a user, pruning completed tasks older than 90 days."""
    data = _read_json(PLAYER_DATA_DIR / username / 'tasks.json', default=[])
    if not isinstance(data, list):
        return []
    cutoff = time.time() - 90 * 86400
    return [t for t in data if isinstance(t, dict)
            and not (t.get('completed') and (t.get('completedAt') or 0) < cutoff)]


def _write_personal_tasks(username: str, tasks: list) -> None:
    _write_json(PLAYER_DATA_DIR / username / 'tasks.json', tasks)


def _read_broadcast_tasks() -> list:
    """Load broadcast_tasks.json, pruning revoked tasks older than 90 days."""
    data = _read_json(BROADCAST_TASKS_FILE, default=[])
    if not isinstance(data, list):
        return []
    cutoff = time.time() - 90 * 86400
    return [t for t in data if isinstance(t, dict)
            and (not t.get('revokedAt') or t['revokedAt'] > cutoff)]


def _write_broadcast_tasks(tasks: list) -> None:
    _write_json(BROADCAST_TASKS_FILE, tasks)


def _validate_task_text(text) -> 'str | None':
    if not isinstance(text, str) or not text.strip():
        return 'Task text must be a non-empty string'
    if len(text) > _TASK_TEXT_MAX:
        return f'Task text must be \u2264{_TASK_TEXT_MAX} characters'
    return None


@app.route('/api/tasks')
@login_required
def api_get_tasks():
    """Return current user's personal tasks + active broadcast tasks."""
    username   = session['username']
    personal   = _read_personal_tasks(username)
    broadcasts = []
    for t in _read_broadcast_tasks():
        if t.get('revokedAt'):
            continue
        broadcasts.append({
            'id':          t['id'],
            'text':        t['text'],
            'priority':    bool(t.get('priority', False)),
            'createdAt':   t['createdAt'],
            'completedAt': (t.get('completedBy') or {}).get(username),
        })
    return jsonify({'personal': personal, 'broadcast': broadcasts})


@app.route('/api/tasks', methods=['POST'])
@login_required
def api_create_task():
    """Create a personal task for the current user."""
    err = _csrf_check()
    if err: return err
    data    = request.get_json(force=True, silent=True) or {}
    err_msg = _validate_task_text(data.get('text'))
    if err_msg:
        return jsonify({'error': err_msg}), 400
    import uuid as _uuid
    task = {
        'id':          str(_uuid.uuid4()),
        'text':        data['text'].strip(),
        'priority':    bool(data.get('priority', False)),
        'completed':   False,
        'completedAt': None,
        'createdAt':   time.time(),
    }
    with _player_lock(session['username']):
        tasks = _read_personal_tasks(session['username'])
        if len(tasks) >= _PERSONAL_TASKS_MAX:
            return jsonify({'error': f'Maximum {_PERSONAL_TASKS_MAX} tasks per user'}), 400
        tasks.append(task)
        _write_personal_tasks(session['username'], tasks)
    return jsonify({'ok': True, 'task': task})


@app.route('/api/tasks/<task_id>', methods=['PUT'])
@login_required
def api_update_task(task_id: str):
    """Edit text/priority or toggle completed on a personal task."""
    err = _csrf_check()
    if err: return err
    if not task_id or len(task_id) > 60:
        return jsonify({'error': 'Invalid task ID'}), 400
    data = request.get_json(force=True, silent=True) or {}
    with _player_lock(session['username']):
        tasks = _read_personal_tasks(session['username'])
        task  = next((t for t in tasks if t.get('id') == task_id), None)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        if 'text' in data:
            err_msg = _validate_task_text(data['text'])
            if err_msg:
                return jsonify({'error': err_msg}), 400
            task['text'] = data['text'].strip()
        if 'priority' in data:
            task['priority'] = bool(data['priority'])
        if 'completed' in data:
            task['completed']   = bool(data['completed'])
            task['completedAt'] = time.time() if task['completed'] else None
        _write_personal_tasks(session['username'], tasks)
    return jsonify({'ok': True, 'task': task})


@app.route('/api/tasks/<task_id>', methods=['DELETE'])
@login_required
def api_delete_task(task_id: str):
    """Delete a personal task owned by the current user."""
    err = _csrf_check()
    if err: return err
    if not task_id or len(task_id) > 60:
        return jsonify({'error': 'Invalid task ID'}), 400
    with _player_lock(session['username']):
        tasks    = _read_personal_tasks(session['username'])
        filtered = [t for t in tasks if t.get('id') != task_id]
        if len(filtered) == len(tasks):
            return jsonify({'error': 'Task not found'}), 404
        _write_personal_tasks(session['username'], filtered)
    return jsonify({'ok': True})


@app.route('/api/tasks/broadcast', methods=['POST'])
@gm_required
def api_create_broadcast_task():
    """GM: create a broadcast task visible to all users."""
    err = _csrf_check()
    if err: return err
    data    = request.get_json(force=True, silent=True) or {}
    err_msg = _validate_task_text(data.get('text'))
    if err_msg:
        return jsonify({'error': err_msg}), 400
    import uuid as _uuid
    task = {
        'id':          str(_uuid.uuid4()),
        'text':        data['text'].strip(),
        'priority':    bool(data.get('priority', False)),
        'createdAt':   time.time(),
        'createdBy':   session['username'],
        'revokedAt':   None,
        'completedBy': {},
    }
    with _broadcast_tasks_lock:
        tasks = _read_broadcast_tasks()
        if len(tasks) >= 200:
            return jsonify({'error': 'Maximum 200 broadcast tasks'}), 400
        tasks.append(task)
        _write_broadcast_tasks(tasks)
    return jsonify({'ok': True, 'task': task})


@app.route('/api/tasks/broadcast/<task_id>', methods=['PUT'])
@gm_required
def api_update_broadcast_task(task_id: str):
    """GM: edit text/priority or revoke a broadcast task."""
    err = _csrf_check()
    if err: return err
    if not task_id or len(task_id) > 60:
        return jsonify({'error': 'Invalid task ID'}), 400
    data = request.get_json(force=True, silent=True) or {}
    with _broadcast_tasks_lock:
        tasks = _read_broadcast_tasks()
        task  = next((t for t in tasks if t.get('id') == task_id), None)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        if 'text' in data:
            err_msg = _validate_task_text(data['text'])
            if err_msg:
                return jsonify({'error': err_msg}), 400
            task['text'] = data['text'].strip()
        if 'priority' in data:
            task['priority'] = bool(data['priority'])
        if data.get('revoke'):
            task['revokedAt'] = time.time()
        _write_broadcast_tasks(tasks)
    return jsonify({'ok': True, 'task': task})


@app.route('/api/tasks/broadcast/<task_id>/complete', methods=['POST'])
@login_required
def api_complete_broadcast_task(task_id: str):
    """Toggle the current user's completion of a broadcast task."""
    err = _csrf_check()
    if err: return err
    if not task_id or len(task_id) > 60:
        return jsonify({'error': 'Invalid task ID'}), 400
    username = session['username']
    with _broadcast_tasks_lock:
        tasks = _read_broadcast_tasks()
        task  = next((t for t in tasks if t.get('id') == task_id
                      and not t.get('revokedAt')), None)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        cb = task.setdefault('completedBy', {})
        if username in cb:
            del cb[username]
            completed = False
        else:
            cb[username]  = time.time()
            completed = True
        _write_broadcast_tasks(tasks)
    return jsonify({'ok': True, 'completed': completed})


@app.route('/api/tasks/assign-gm', methods=['POST'])
@login_required
def api_assign_task_to_gm():
    """Any logged-in user: add a task to the GM's personal task list."""
    err = _csrf_check()
    if err: return err
    data    = request.get_json(force=True, silent=True) or {}
    err_msg = _validate_task_text(data.get('text'))
    if err_msg:
        return jsonify({'error': err_msg}), 400
    gm_username = next(
        (u['username'] for u in load_users() if u.get('role') == 'gm'), None)
    if not gm_username:
        return jsonify({'error': 'No GM account found'}), 404
    import uuid as _uuid
    task = {
        'id':          str(_uuid.uuid4()),
        'text':        data['text'].strip(),
        'priority':    False,
        'completed':   False,
        'completedAt': None,
        'createdAt':   time.time(),
        'assignedBy':  session['username'],
    }
    with _player_lock(gm_username):
        tasks = _read_personal_tasks(gm_username)
        if len(tasks) >= _PERSONAL_TASKS_MAX:
            return jsonify({'error': 'GM task list is full'}), 400
        tasks.append(task)
        _write_personal_tasks(gm_username, tasks)
    return jsonify({'ok': True})


# ── NOTES ─────────────────────────────────────────────────────────────────────

_NOTES_DEFAULTS = {'general': '', 'manor_notes': '', 'impressions': {}}


def _read_notes(username: str) -> dict:
    """Returns notes dict with defaults if missing."""
    data = _read_json(PLAYER_DATA_DIR / username / 'notes.json', default=None)
    if not isinstance(data, dict):
        return dict(_NOTES_DEFAULTS)
    return {
        'general':     data.get('general', ''),
        'manor_notes': data.get('manor_notes', ''),
        'impressions': data.get('impressions', {}),
    }


def _write_notes(username: str, data: dict) -> None:
    """Atomic write to player_data/{username}/notes.json."""
    _write_json(PLAYER_DATA_DIR / username / 'notes.json', data)


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
    if len(impressions) > 100:
        return jsonify({'error': 'Too many impressions'}), 400
    for k, v in impressions.items():
        if not isinstance(k, str) or not isinstance(v, str):
            return jsonify({'error': 'impressions keys and values must be strings'}), 400
        if len(v) > 2000:
            return jsonify({'error': 'Each impression must be ≤2000 chars'}), 400
    with _player_lock(session['username']):
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
    if len(impressions) > 100:
        return jsonify({'error': 'Too many impressions'}), 400
    for k, v in impressions.items():
        if not isinstance(k, str) or not isinstance(v, str):
            return jsonify({'error': 'impressions keys and values must be strings'}), 400
        if len(v) > 2000:
            return jsonify({'error': 'Each impression must be ≤2000 chars'}), 400
    with _player_lock(username):
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
    """Returns comments list from comments.json. Caller must hold _comments_lock for writes."""
    return _read_json(COMMENTS_FILE, default=[]) or []


def _write_comments(comments: list) -> None:
    """Atomic write to comments.json. Caller must hold _comments_lock.
    Opportunistically purges soft-deleted entries whose original creation
    timestamp is older than 30 days, keeping the file from growing forever."""
    cutoff_dt = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    def _is_purgeable(c: dict) -> bool:
        if not c.get('deleted'):
            return False
        history = c.get('history') or []
        ts_str  = history[0].get('ts', '') if history else ''
        try:
            created = datetime.strptime(ts_str, '%Y-%m-%dT%H:%M:%S.%fZ')
            return created < cutoff_dt
        except (ValueError, TypeError):
            return False
    if any(_is_purgeable(c) for c in comments):
        comments = [c for c in comments if not _is_purgeable(c)]
    _write_json(COMMENTS_FILE, comments)


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
    ts = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z'
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

    with _comments_lock:
        all_comments = _read_comments()
        all_comments.append(new_comment)
        _write_comments(all_comments)

    # Notify all other users — resolve the NPC's name for readable text
    npc_name = npc_id
    binder = _load_binder()
    if binder:
        npc = next((n for n in _all_npcs(binder) if n.get('id') == npc_id), None)
        if npc and npc.get('name'):
            npc_name = npc['name']
    all_users = load_users()
    for u in all_users:
        uname = u['username']
        if uname != author:
            _push_notification(
                uname, 'comment',
                f'{author} commented on {npc_name}',
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

    with _comments_lock:
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

        ts = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z'
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

    with _comments_lock:
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
    with _comments_lock:
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
    with _comments_lock:
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


# ── BATTLE TRACKER ────────────────────────────────────────────────────────────

BATTLE_SIZES = ('fight', 'skirmish', 'clash', 'small', 'medium', 'large', 'huge')
BATTLE_SIZE_LABELS = {
    'fight': 'Fight', 'skirmish': 'Skirmish', 'clash': 'Clash',
    'small': 'Small Battle', 'medium': 'Medium Battle',
    'large': 'Large Battle', 'huge': 'Huge Battle',
}
BATTLE_STATES = ('setup', 'active', 'finalizing', 'finalized')
PARTICIPANT_STATUSES = ('active', 'major_wound', 'unconscious', 'dead', 'alone', 'rear')
POSTURES = ('valorous', 'reckless', 'prudent', 'cowardly')
ENEMY_STATUSES = ('active', 'major_wound', 'dead', 'captured', 'fled')
BATTLE_OUTCOMES = ('decisive_victory', 'victory', 'indecisive', 'defeat', 'decisive_defeat', 'scripted')

_battle_lock = threading.RLock()


def _with_battle_lock(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        with _battle_lock:
            return f(*args, **kwargs)
    return wrapper


def _read_battle_file() -> dict:
    with _battle_lock:
        return _read_json(BATTLE_FILE, default={'active': None, 'archived': {}})


def _get_active_battle() -> dict | None:
    with _battle_lock:
        return _read_json(BATTLE_FILE, default={'active': None, 'archived': {}}).get('active')


def _save_active_battle(battle: dict) -> None:
    with _battle_lock:
        data = _read_json(BATTLE_FILE, default={'active': None, 'archived': {}})
        data['active'] = battle
        _write_json(BATTLE_FILE, data)


def _clear_active_battle() -> None:
    with _battle_lock:
        data = _read_json(BATTLE_FILE, default={'active': None, 'archived': {}})
        data['active'] = None
        _write_json(BATTLE_FILE, data)


def _archive_battle(battle: dict) -> None:
    with _battle_lock:
        data = _read_json(BATTLE_FILE, default={'active': None, 'archived': {}})
        data['active'] = None
        data.setdefault('archived', {})[battle['id']] = battle
        _write_json(BATTLE_FILE, data)


def _filter_battle_for_player(battle: dict, username: str) -> dict | None:
    """Strip GM-only fields from battle state for player/observer view."""
    if not battle:
        return None
    b = {k: v for k, v in battle.items()
         if k not in ('gmNotes', 'intensity', 'roundNotes')}
    b['foes'] = [{'foeId': f['foeId'], 'type': f['type']} for f in battle.get('foes', [])]
    filtered = []
    for p in battle.get('participants', []):
        is_own = (p.get('controlledBy') == username)
        if is_own:
            fp = dict(p)
            fp['enemies'] = [
                {k: v for k, v in e.items()
                 if k not in ('hp', 'maxHp', 'armor', 'skill', 'damage')}
                for e in p.get('enemies', [])
            ]
        else:
            fp = {
                'participantId': p.get('participantId'),
                'name': p.get('name'),
                'npcId': p.get('npcId'),
                'isPK': p.get('isPK'),
                'isCommander': p.get('isCommander'),
                'status': p.get('status'),
                'posture': p.get('posture'),
                'passion': p.get('passion'),
            }
        filtered.append(fp)
    b['participants'] = filtered
    b['rounds'] = [
        {k: v for k, v in r.items() if k not in ('notes', 'snapshot')}
        for r in battle.get('rounds', [])
    ]
    return b


def _find_participant(battle, pid):
    for p in battle.get('participants', []):
        if p.get('participantId') == pid:
            return p
    return None


def _find_enemy(battle, eid):
    for p in battle.get('participants', []):
        for e in p.get('enemies', []):
            if e.get('enemyId') == eid:
                return p, e
    return None, None


def _build_encounter_label(battle, enc):
    if enc.get('retired'):
        return 'Retired to Rear'
    foe_id = enc.get('foeId')
    if foe_id:
        foe = next((f for f in battle.get('foes', []) if f['foeId'] == foe_id), None)
        if foe:
            weapon = foe.get('weapon', '')
            return f"{foe['type']} ({weapon})" if weapon else foe['type']
    return enc.get('text', '') or 'Encounter'


# ── Battle API — Read ─────────────────────────────────────────────────────────

@app.route('/api/battle/active')
@login_required
def api_battle_active():
    """Lightweight poll endpoint for the IN BATTLE banner. 3s cadence."""
    battle = _get_active_battle()
    if not battle:
        return jsonify({'active': False})
    return jsonify({
        'active': True,
        'id': battle.get('id'),
        'name': battle.get('name', ''),
        'state': battle.get('state', 'setup'),
        'size': battle.get('size', ''),
        'currentRound': battle.get('currentRound', 0),
        'maxRounds': battle.get('maxRounds', 0),
    })


@app.route('/api/battle/state')
@login_required
def api_battle_state():
    """Full battle state, filtered by role."""
    battle = _get_active_battle()
    if not battle:
        return jsonify({'battle': None})
    if session.get('role') == 'gm':
        return jsonify({'battle': battle})
    return jsonify({'battle': _filter_battle_for_player(battle, session.get('username', ''))})


# ── Battle API — GM Setup ────────────────────────────────────────────────────

BATTLE_DEFAULT_ROUNDS = {
    'fight': 1, 'skirmish': 3, 'clash': 5, 'small': 6,
    'medium': 7, 'large': 8, 'huge': 8,
}


@app.route('/api/battle/create', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_create():
    err = _csrf_check()
    if err: return err
    if _get_active_battle():
        return jsonify({'error': 'A battle is already active'}), 409
    now = datetime.now(timezone.utc).isoformat()
    battle_id = 'battle_' + str(int(time.time()))
    battle = {
        'id': battle_id,
        'state': 'setup',
        'name': '',
        'year': 0,
        'location': '',
        'size': 'skirmish',
        'maxRounds': BATTLE_DEFAULT_ROUNDS['skirmish'],
        'intensity': 10,
        'friendlyCommander': {'name': '', 'npcId': None, 'battle': ''},
        'enemyCommander': {'name': '', 'npcId': None, 'battle': ''},
        'conroiCommanderId': None,
        'gmNotes': '',
        'foes': [],
        'participants': [],
        'morale': {'current': 0, 'starting': 0},
        'currentRound': 0,
        'rounds': [],
        'createdAt': now,
        'createdBy': session['username'],
    }
    _save_active_battle(battle)
    log.info('Battle created: %s by %s', battle_id, session['username'])
    return jsonify({'battle': battle}), 201


@app.route('/api/battle/setup', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_setup():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    if battle['state'] != 'setup':
        return jsonify({'error': 'Battle is not in setup state'}), 409
    body = request.get_json(silent=True) or {}
    allowed = ('name', 'year', 'location', 'size', 'intensity',
               'friendlyCommander', 'enemyCommander',
               'conroiCommanderId', 'gmNotes', 'maxRounds')
    for key in allowed:
        if key in body:
            battle[key] = body[key]
    if 'size' in body and body['size'] in BATTLE_DEFAULT_ROUNDS:
        if 'maxRounds' not in body:
            battle['maxRounds'] = BATTLE_DEFAULT_ROUNDS[body['size']]
    if 'morale' in body:
        m = body['morale']
        if isinstance(m, dict):
            battle['morale'] = {
                'current': int(m.get('current', 0)),
                'starting': int(m.get('starting', 0)),
            }
    _save_active_battle(battle)
    return jsonify({'battle': battle})


@app.route('/api/battle/start', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_start():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    if battle['state'] != 'setup':
        return jsonify({'error': 'Battle is not in setup state'}), 409
    if not battle.get('name', '').strip():
        return jsonify({'error': 'Battle needs a name'}), 422
    if not battle.get('participants'):
        return jsonify({'error': 'Add at least one participant'}), 422
    try:
        if int(battle.get('maxRounds') or 0) < 1:
            return jsonify({'error': 'Max rounds must be at least 1'}), 422
    except (ValueError, TypeError):
        return jsonify({'error': 'Max rounds must be at least 1'}), 422
    battle['state'] = 'active'
    battle['currentRound'] = 1
    battle['rounds'] = []
    battle['encounter'] = {'text': '', 'foeId': None, 'retired': False}
    battle['roundNotes'] = ''
    battle['moraleAtRoundStart'] = battle.get('morale', {}).get('current', 0)
    _rotate_battle_backup()
    _save_active_battle(battle)
    log.info('Battle started: %s (%s)', battle['name'], battle['id'])
    return jsonify({'battle': battle})


@app.route('/api/battle/foe', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_add_foe():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    if battle['state'] not in ('setup', 'active'):
        return jsonify({'error': 'Cannot modify foes in this state'}), 409
    body = request.get_json(silent=True) or {}
    foe_id = 'foe_' + _secrets_mod.token_hex(8)
    foe = {
        'foeId': foe_id,
        'type': body.get('type', 'Unknown'),
        'weapon': body.get('weapon', ''),
        'hp': int(body.get('hp', 0)),
        'armor': body.get('armor', ''),
        'skill': int(body.get('skill', 0)),
        'damage': body.get('damage', ''),
        'kv': float(body.get('kv', 0)),
        'glory': int(body.get('glory', 0)),
        'moraleLoss': body.get('moraleLoss', ''),
        'moraleMin': int(body.get('moraleMin', 0)),
        'perPK': body.get('perPK', 1),
        'skills': body.get('skills', ''),
        'behavior': body.get('behavior', ''),
    }
    battle['foes'].append(foe)
    _save_active_battle(battle)
    return jsonify({'foe': foe}), 201


@app.route('/api/battle/foe/<foe_id>', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_update_foe(foe_id):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    if battle['state'] not in ('setup', 'active'):
        return jsonify({'error': 'Cannot modify foes in this state'}), 409
    foe = next((f for f in battle['foes'] if f['foeId'] == foe_id), None)
    if not foe:
        return jsonify({'error': 'Foe not found'}), 404
    body = request.get_json(silent=True) or {}
    updatable = ('type', 'weapon', 'hp', 'armor', 'skill', 'damage',
                 'kv', 'glory', 'moraleLoss', 'moraleMin', 'perPK', 'skills', 'behavior')
    try:
        for key in updatable:
            if key in body:
                if key in ('hp', 'skill', 'glory', 'moraleMin'):
                    foe[key] = int(body[key])
                elif key == 'kv':
                    foe[key] = float(body[key])
                else:
                    foe[key] = body[key]
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid numeric value'}), 422
    _save_active_battle(battle)
    return jsonify({'foe': foe})


@app.route('/api/battle/foe/<foe_id>', methods=['DELETE'])
@gm_required
@_with_battle_lock
def api_battle_delete_foe(foe_id):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    before = len(battle['foes'])
    battle['foes'] = [f for f in battle['foes'] if f['foeId'] != foe_id]
    if len(battle['foes']) == before:
        return jsonify({'error': 'Foe not found'}), 404
    _save_active_battle(battle)
    return jsonify({'ok': True})


@app.route('/api/battle/participant', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_add_participant():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    if battle['state'] not in ('setup', 'active'):
        return jsonify({'error': 'Cannot add participants in this state'}), 409
    body = request.get_json(silent=True) or {}
    pid = 'p_' + _secrets_mod.token_hex(8)
    participant = {
        'participantId': pid,
        'name': body.get('name', ''),
        'npcId': body.get('npcId'),
        'controlledBy': body.get('controlledBy'),
        'isPK': bool(body.get('isPK', False)),
        'isCommander': False,
        'status': 'active',
        'posture': None,
        'passion': None,
        'enemies': [],
        'killLedger': [],
    }
    battle['participants'].append(participant)
    _save_active_battle(battle)
    return jsonify({'participant': participant}), 201


@app.route('/api/battle/participant/<pid>', methods=['DELETE'])
@gm_required
@_with_battle_lock
def api_battle_remove_participant(pid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    before = len(battle['participants'])
    battle['participants'] = [p for p in battle['participants'] if p['participantId'] != pid]
    if len(battle['participants']) == before:
        return jsonify({'error': 'Participant not found'}), 404
    if battle.get('conroiCommanderId') == pid:
        battle['conroiCommanderId'] = None
    _save_active_battle(battle)
    return jsonify({'ok': True})


# ── Battle API — GM Battle Ops ───────────────────────────────────────────────

@app.route('/api/battle/encounter', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_set_encounter():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    enc = battle.get('encounter', {'text': '', 'foeId': None, 'retired': False})
    if 'text' in body:
        enc['text'] = str(body['text'])
    if 'foeId' in body:
        foe_id = body['foeId']
        if foe_id and not any(f['foeId'] == foe_id for f in battle.get('foes', [])):
            return jsonify({'error': 'Foe not found'}), 404
        enc['foeId'] = foe_id
    if 'retired' in body:
        enc['retired'] = bool(body['retired'])
    battle['encounter'] = enc
    _save_active_battle(battle)
    return jsonify({'encounter': enc})


@app.route('/api/battle/morale', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_morale():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    m = battle['morale']
    try:
        if 'current' in body:
            m['current'] = min(m['starting'], max(0, int(body['current'])))
        elif 'delta' in body:
            m['current'] = min(m['starting'], max(0, m['current'] + int(body['delta'])))
        if 'starting' in body:
            m['starting'] = max(0, int(body['starting']))
            m['current'] = min(m['current'], m['starting'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Morale values must be integers'}), 422
    _save_active_battle(battle)
    return jsonify({'morale': m})


@app.route('/api/battle/participant/<pid>/status', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_participant_status(pid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    status = body.get('status')
    if status not in PARTICIPANT_STATUSES:
        return jsonify({'error': f'Invalid status: {status}'}), 422
    p = _find_participant(battle, pid)
    if not p:
        return jsonify({'error': 'Participant not found'}), 404
    p['status'] = status
    _save_active_battle(battle)
    return jsonify({'participant': p})


@app.route('/api/battle/participant/<pid>/posture', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_participant_posture(pid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    posture = body.get('posture')
    if posture is not None and posture not in POSTURES:
        return jsonify({'error': f'Invalid posture: {posture}'}), 422
    p = _find_participant(battle, pid)
    if not p:
        return jsonify({'error': 'Participant not found'}), 404
    p['posture'] = posture
    _save_active_battle(battle)
    return jsonify({'participant': p})


@app.route('/api/battle/participant/<pid>/passion', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_participant_passion(pid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    p = _find_participant(battle, pid)
    if not p:
        return jsonify({'error': 'Participant not found'}), 404
    if p.get('passion'):
        return jsonify({'error': 'Passion already invoked this battle'}), 409
    name = str(body.get('name', '')).strip()
    result = body.get('result', '')
    if not name or result not in ('inspired', 'impassioned', 'failed', 'fumbled'):
        return jsonify({'error': 'Provide passion name and result (inspired/impassioned/failed/fumbled)'}), 422
    p['passion'] = {'name': name, 'result': result, 'round': battle['currentRound']}
    _save_active_battle(battle)
    return jsonify({'participant': p})


@app.route('/api/battle/participant/<pid>/enemy', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_assign_enemy(pid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    p = _find_participant(battle, pid)
    if not p:
        return jsonify({'error': 'Participant not found'}), 404
    body = request.get_json(silent=True) or {}
    foe_id = body.get('foeId')
    foe = None
    if foe_id:
        foe = next((f for f in battle.get('foes', []) if f['foeId'] == foe_id), None)
    eid = 'e_' + _secrets_mod.token_hex(8)
    enemy = {
        'enemyId': eid,
        'foeId': foe_id,
        'label': body.get('label', ''),
        'type': body.get('type', foe['type'] if foe else 'Unknown'),
        'weapon': body.get('weapon', foe.get('weapon', '') if foe else ''),
        'hp': int(body.get('hp', foe['hp'] if foe else 0)),
        'maxHp': int(body.get('maxHp', body.get('hp', foe['hp'] if foe else 0))),
        'armor': body.get('armor', foe.get('armor', '') if foe else ''),
        'skill': int(body.get('skill', foe['skill'] if foe else 0)),
        'damage': body.get('damage', foe.get('damage', '') if foe else ''),
        'kv': float(body.get('kv', foe['kv'] if foe else 0)),
        'glory': int(body.get('glory', foe['glory'] if foe else 0)),
        'status': 'active',
    }
    p['enemies'].append(enemy)
    _save_active_battle(battle)
    return jsonify({'enemy': enemy}), 201


@app.route('/api/battle/enemy/<eid>/hp', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_enemy_hp(eid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    p, enemy = _find_enemy(battle, eid)
    if not enemy:
        return jsonify({'error': 'Enemy not found'}), 404
    body = request.get_json(silent=True) or {}
    try:
        if 'hp' in body:
            enemy['hp'] = max(0, min(enemy['maxHp'], int(body['hp'])))
        else:
            delta = int(body.get('delta', 0))
            enemy['hp'] = max(0, min(enemy['maxHp'], enemy['hp'] + delta))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid HP value'}), 422
    _save_active_battle(battle)
    return jsonify({'enemy': enemy})


@app.route('/api/battle/enemy/<eid>/status', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_enemy_status(eid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    p, enemy = _find_enemy(battle, eid)
    if not enemy:
        return jsonify({'error': 'Enemy not found'}), 404
    body = request.get_json(silent=True) or {}
    status = body.get('status')
    if status not in ENEMY_STATUSES:
        return jsonify({'error': f'Invalid status: {status}'}), 422
    enemy['status'] = status
    kill = None
    already_killed = any(k.get('enemyId') == eid for k in p.get('killLedger', []))
    if status in ('dead', 'captured', 'major_wound') and not already_killed:
        kill = {
            'killId': 'k_' + _secrets_mod.token_hex(8),
            'enemyId': eid,
            'type': enemy.get('type', ''),
            'weapon': enemy.get('weapon', ''),
            'glory': enemy.get('glory', 0),
            'kv': enemy.get('kv', 0),
            'round': battle['currentRound'],
        }
        p['killLedger'].append(kill)
    _save_active_battle(battle)
    return jsonify({'enemy': enemy, 'kill': kill})


@app.route('/api/battle/enemy/<eid>/undo', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_enemy_undo(eid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    p, enemy = _find_enemy(battle, eid)
    if not enemy:
        return jsonify({'error': 'Enemy not found'}), 404
    if enemy['status'] == 'active':
        return jsonify({'error': 'Enemy is already active'}), 409
    prev_status = enemy['status']
    enemy['status'] = 'active'
    if prev_status in ('dead', 'captured', 'major_wound'):
        ledger = p.get('killLedger', [])
        for i in range(len(ledger) - 1, -1, -1):
            k = ledger[i]
            if k.get('enemyId') == eid:
                ledger.pop(i)
                break
    _save_active_battle(battle)
    return jsonify({'enemy': enemy})


@app.route('/api/battle/enemy/<eid>/reassign', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_enemy_reassign(eid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    target_pid = body.get('targetPid')
    if not target_pid:
        return jsonify({'error': 'targetPid required'}), 422
    src_p, enemy = _find_enemy(battle, eid)
    if not enemy:
        return jsonify({'error': 'Enemy not found'}), 404
    tgt_p = _find_participant(battle, target_pid)
    if not tgt_p:
        return jsonify({'error': 'Target participant not found'}), 404
    if src_p['participantId'] == target_pid:
        return jsonify({'error': 'Enemy already assigned to this participant'}), 409
    src_p['enemies'] = [e for e in src_p.get('enemies', []) if e['enemyId'] != eid]
    tgt_p.setdefault('enemies', []).append(enemy)
    kills_to_move = [k for k in src_p.get('killLedger', []) if k.get('enemyId') == eid]
    if kills_to_move:
        src_p['killLedger'] = [k for k in src_p['killLedger'] if k.get('enemyId') != eid]
        tgt_p.setdefault('killLedger', []).extend(kills_to_move)
    _save_active_battle(battle)
    log.info('Enemy %s reassigned from %s to %s', eid, src_p['name'], tgt_p['name'])
    return jsonify({'battle': battle})


@app.route('/api/battle/participant/<pid>/control', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_participant_control(pid):
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    p = _find_participant(battle, pid)
    if not p:
        return jsonify({'error': 'Participant not found'}), 404
    body = request.get_json(silent=True) or {}
    p['controlledBy'] = body.get('controlledBy') or None
    _save_active_battle(battle)
    return jsonify({'participant': p})


@app.route('/api/battle/round-notes', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_round_notes():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    battle['roundNotes'] = str(body.get('notes', ''))
    _save_active_battle(battle)
    return jsonify({'ok': True})


@app.route('/api/battle/max-rounds', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_max_rounds():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    try:
        if 'delta' in body:
            battle['maxRounds'] = max(battle['currentRound'], battle['maxRounds'] + int(body['delta']))
        elif 'maxRounds' in body:
            battle['maxRounds'] = max(battle['currentRound'], int(body['maxRounds']))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid value'}), 422
    _save_active_battle(battle)
    return jsonify({'maxRounds': battle['maxRounds']})


@app.route('/api/battle/conroi-commander', methods=['PATCH'])
@gm_required
@_with_battle_lock
def api_battle_conroi_commander():
    """Designate (or swap) the conroi commander — allowed mid-battle, unlike
    /api/battle/setup, so the GM can hand off command when the commander falls."""
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] not in ('setup', 'active'):
        return jsonify({'error': 'No battle in setup or in progress'}), 404
    body = request.get_json(silent=True) or {}
    pid = body.get('participantId')
    if pid is not None and not _find_participant(battle, pid):
        return jsonify({'error': 'Participant not found'}), 404
    battle['conroiCommanderId'] = pid
    _save_active_battle(battle)
    log.info('Conroi commander set to %s: %s', pid, battle['id'])
    return jsonify({'battle': battle})


@app.route('/api/battle/round/end', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_round_end():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    if 'round' in body and body['round'] != battle['currentRound']:
        return jsonify({'error': 'Round already ended'}), 409
    snapshot = {
        'participants': copy.deepcopy(battle['participants']),
        'morale': copy.deepcopy(battle['morale']),
        'encounter': copy.deepcopy(battle.get('encounter', {})),
        'roundNotes': battle.get('roundNotes', ''),
    }
    enc = battle.get('encounter', {})
    morale_start = battle.get('moraleAtRoundStart', snapshot['morale']['current'])
    round_entry = {
        'round': battle['currentRound'],
        'encounter': _build_encounter_label(battle, enc),
        'foeId': enc.get('foeId'),
        'retired': enc.get('retired', False),
        'morale': {'start': morale_start, 'end': battle['morale']['current']},
        'notes': battle.get('roundNotes', ''),
        'snapshot': snapshot,
    }
    battle['rounds'].append(round_entry)
    battle['currentRound'] += 1
    battle['moraleAtRoundStart'] = battle['morale']['current']
    for p in battle['participants']:
        p['posture'] = None
        p['enemies'] = []
    battle['encounter'] = {'text': '', 'foeId': None, 'retired': False}
    battle['roundNotes'] = ''
    _rotate_battle_backup()
    _save_active_battle(battle)
    log.info('Battle round %d ended: %s', round_entry['round'], battle['id'])
    return jsonify({'battle': battle})


@app.route('/api/battle/round/back', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_round_back():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    if not battle.get('rounds'):
        return jsonify({'error': 'No previous round to revert to'}), 409
    prev = battle['rounds'].pop()
    snap = prev.get('snapshot', {})
    battle['participants'] = copy.deepcopy(snap.get('participants', battle['participants']))
    battle['morale'] = copy.deepcopy(snap.get('morale', battle['morale']))
    battle['encounter'] = copy.deepcopy(snap.get('encounter', {'text': '', 'foeId': None, 'retired': False}))
    battle['roundNotes'] = snap.get('roundNotes', '')
    battle['moraleAtRoundStart'] = prev.get('morale', {}).get('start', battle['morale']['current'])
    battle['currentRound'] -= 1
    _save_active_battle(battle)
    log.info('Battle reverted to round %d: %s', battle['currentRound'], battle['id'])
    return jsonify({'battle': battle})


# ── Battle API — GM Finalize ─────────────────────────────────────────────────

@app.route('/api/battle/finalize', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_finalize():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    battle['state'] = 'finalizing'
    _rotate_battle_backup()
    _save_active_battle(battle)
    log.info('Battle ended: %s (round %d/%d)', battle['name'], battle['currentRound'], battle['maxRounds'])
    return jsonify({'battle': battle})


@app.route('/api/battle/resume', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_resume():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'finalizing':
        return jsonify({'error': 'No finalizing battle to resume'}), 404
    battle['state'] = 'active'
    _save_active_battle(battle)
    log.info('Battle resumed: %s', battle['name'])
    return jsonify({'battle': battle})


# ── Battle API — Auto-summary ────────────────────────────────────────────────
# Drafts a chronicle narrative from the battle record via Claude Haiku
# (ANTHROPIC_KEY in secrets.env). Falls back to a plain data-built summary if
# the key is missing or the API call fails. The GM always edits before commit.

BATTLE_OUTCOME_LABELS = {
    'decisive_victory': 'a decisive victory', 'victory': 'a victory',
    'indecisive': 'indecisive', 'defeat': 'a defeat',
    'decisive_defeat': 'a decisive defeat', 'scripted': 'as fate decreed',
}
BATTLE_SIZE_LABELS = {
    'fight': 'Fight', 'skirmish': 'Skirmish', 'clash': 'Clash',
    'small': 'Small Battle', 'medium': 'Medium Battle',
    'large': 'Large Battle', 'huge': 'Huge Battle',
}
BATTLE_SUMMARY_SYSTEM = (
    'You are the chronicler for a Pendragon 6th Edition tabletop campaign set in '
    'Arthurian Britain. Draft a battle account for the campaign chronicle from the '
    'battle record provided.\n'
    '- Write 3 to 5 sentences of flowing prose in the voice of a medieval chronicler.\n'
    '- Recount only what the record states. Never invent actions, words, thoughts, or '
    'motives for any knight, and never add events that are not in the record.\n'
    '- Name the knights whose deeds (kills, wounds, passions) the record shows.\n'
    "- Describe only what the assembled host could witness; do not reveal the GM's "
    'secret notes or plans even if the record hints at them.\n'
    '- Return only the chronicle text — no preamble, headings, or commentary.'
)


def _build_battle_digest(battle, outcome):
    """Flatten the battle record into plain text for the summary model."""
    lines = []
    size = BATTLE_SIZE_LABELS.get(battle.get('size'), battle.get('size', ''))
    lines.append(f"Battle: {battle.get('name', 'Unnamed Battle')} ({size})")
    if battle.get('year'):
        lines.append(f"Year: {battle['year']} AD")
    if battle.get('location'):
        lines.append(f"Location: {battle['location']}")
    if outcome in BATTLE_OUTCOME_LABELS:
        lines.append(f"Outcome for the conroi: {BATTLE_OUTCOME_LABELS[outcome]}")
    fc, ec = battle.get('friendlyCommander') or {}, battle.get('enemyCommander') or {}
    if fc.get('name') or ec.get('name'):
        lines.append(f"Commanders: {fc.get('name', 'unknown')} against {ec.get('name', 'unknown')}")
    m = battle.get('morale') or {}
    lines.append(f"Conroi morale: began at {m.get('starting', '?')}, ended at {m.get('current', '?')}")
    lines.append('')
    lines.append('Rounds:')
    for r in battle.get('rounds', []):
        rm = r.get('morale') or {}
        parts = [f"Round {r.get('round')}: {r.get('encounter') or 'no encounter'}"]
        if r.get('retired'):
            parts.append('(the conroi retired to the rear)')
        parts.append(f"morale {rm.get('start', '?')} to {rm.get('end', '?')}")
        if r.get('notes'):
            parts.append(f"— GM round notes: {r['notes']}")
        lines.append('  ' + ', '.join(parts))
    lines.append('')
    lines.append('The conroi:')
    status_labels = {
        'active': 'stood at battle\'s end', 'major_wound': 'suffered a major wound',
        'unconscious': 'was struck unconscious', 'dead': 'was slain',
        'alone': 'was left alone in the field', 'rear': 'retired to the rear',
    }
    for p in battle.get('participants', []):
        ledger = p.get('killLedger', [])
        kinds = {}
        for k in ledger:
            kinds[k.get('type', 'foe')] = kinds.get(k.get('type', 'foe'), 0) + 1
        kills = ', '.join(f"{n}x {t}" for t, n in kinds.items()) if kinds else 'no recorded kills'
        line = f"  {p.get('name', '?')}: {status_labels.get(p.get('status'), p.get('status', ''))}; kills: {kills}"
        if p.get('passion'):
            line += f"; invoked passion {p['passion'].get('name', '')} ({p['passion'].get('result', '')})"
        if p.get('participantId') == battle.get('conroiCommanderId'):
            line += ' [conroi commander]'
        lines.append(line)
    return '\n'.join(lines)


def _fallback_battle_summary(battle, outcome):
    """Deterministic summary from the record, used when the API is unavailable."""
    name = battle.get('name', 'The battle')
    where = f" at {battle['location']}" if battle.get('location') else ''
    when = f" in the year {battle['year']}" if battle.get('year') else ''
    rounds = battle.get('rounds', [])
    sentences = [f"{name} was fought{where}{when}, over {max(len(rounds), 1)} round(s)."]
    if outcome in BATTLE_OUTCOME_LABELS:
        sentences.append(f"For the conroi it was {BATTLE_OUTCOME_LABELS[outcome]}.")
    deeds = []
    for p in battle.get('participants', []):
        n = len(p.get('killLedger', []))
        if n:
            deeds.append(f"{p.get('name', '?')} felled {n} foe{'s' if n != 1 else ''}")
    if deeds:
        sentences.append('; '.join(deeds) + '.')
    fallen = [p.get('name', '?') for p in battle.get('participants', []) if p.get('status') == 'dead']
    if fallen:
        sentences.append(f"Slain in the fighting: {', '.join(fallen)}.")
    return ' '.join(sentences)


@app.route('/api/battle/summary', methods=['POST'])
@gm_required
def api_battle_summary():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle.get('state') != 'finalizing':
        return jsonify({'error': 'No battle in finalizing state'}), 400
    body = request.get_json(silent=True) or {}
    outcome = body.get('outcome') or ''
    digest = _build_battle_digest(battle, outcome)
    api_key = SECRETS.get('ANTHROPIC_KEY')
    if api_key:
        try:
            # Imported lazily so the binder still boots if the SDK isn't installed.
            import anthropic
            client = anthropic.Anthropic(api_key=api_key, timeout=25.0, max_retries=1)
            resp = client.messages.create(
                model='claude-haiku-4-5',
                max_tokens=400,
                system=BATTLE_SUMMARY_SYSTEM,
                messages=[{'role': 'user', 'content': digest}],
            )
            text = ''.join(b.text for b in resp.content if b.type == 'text').strip()
            if text:
                return jsonify({'summary': text, 'source': 'haiku'})
            log.warning('[Battle] Summary API returned no text (stop_reason=%s)', resp.stop_reason)
        except Exception as e:
            log.warning('[Battle] Summary API call failed: %s', e)
    return jsonify({'summary': _fallback_battle_summary(battle, outcome), 'source': 'fallback'})


@app.route('/api/battle/commit', methods=['POST'])
@gm_required
@_with_battle_lock
def api_battle_commit():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle.get('state') != 'finalizing':
        return jsonify({'error': 'No battle in finalizing state'}), 400
    body = request.get_json(force=True) or {}
    outcome = body.get('outcome', 'indecisive')
    if outcome not in BATTLE_OUTCOMES:
        return jsonify({'error': 'Invalid outcome'}), 400
    gm_narrative = str(body.get('gmNarrative', '')).strip()
    participants = []
    for p in battle.get('participants', []):
        ledger = p.get('killLedger', [])
        participants.append({
            'name': p['name'], 'npcId': p.get('npcId'),
            'isPK': p.get('isPK', False), 'status': p.get('status', 'active'),
            'kills': len(ledger),
            'kv': sum(k.get('kv', 0) for k in ledger),
            'glory': sum(k.get('glory', 0) for k in ledger),
            'foes': [k.get('type', '') for k in ledger if k.get('type')],
            'passion': p.get('passion'),
        })
    year_key = str(battle.get('year', ''))
    entry = {
        'id': 'ev-' + _secrets_mod.token_hex(8),
        'text': battle['name'], 'cat': 'battle',
        'ts': int(time.time() * 1000), 'type': 'battle',
        'payload': {
            'name': battle['name'], 'location': battle.get('location', ''),
            'size': battle.get('size', ''), 'outcome': outcome,
            'gmNarrative': gm_narrative,
            'rounds': battle.get('currentRound', 0),
            'maxRounds': battle.get('maxRounds', 0),
            'friendlyCommander': battle.get('friendlyCommander'),
            'enemyCommander': battle.get('enemyCommander'),
            'participants': participants,
            'morale': battle.get('morale'),
            # Trimmed round log for chronicle key-moments rendering — snapshots
            # are dropped (they hold full participant deep-copies per round).
            'roundLog': [
                {
                    'round': r.get('round'),
                    'encounter': r.get('encounter', ''),
                    'morale': r.get('morale'),
                    'notes': r.get('notes', ''),
                }
                for r in battle.get('rounds', [])
            ],
        },
    }
    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 500
    with _save_lock:
        binder = json.loads(save_path.read_text(encoding='utf-8'))
        binder.setdefault('chronicle', {}).setdefault(year_key, []).append(entry)
        _rotate_backup(save_path)
        _atomic_write(save_path, json.dumps(binder, indent=2))
    battle['state'] = 'finalized'
    battle['outcome'] = outcome
    battle['gmNarrative'] = gm_narrative
    _archive_battle(battle)
    _rotate_battle_backup()
    log.info('[Battle] Committed to chronicle: %s (year %s, %s)',
             battle['name'], year_key, outcome)
    return jsonify({'ok': True})


@app.route('/api/battle/abandon', methods=['DELETE'])
@gm_required
@_with_battle_lock
def api_battle_abandon():
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle:
        return jsonify({'error': 'No active battle'}), 404
    log.info('Battle abandoned: %s (%s)', battle.get('name', ''), battle['id'])
    _clear_active_battle()
    return jsonify({'ok': True})


# ── Battle API — Player Actions ──────────────────────────────────────────────

@app.route('/api/battle/my-kill', methods=['POST'])
@login_required
@_with_battle_lock
def api_battle_my_kill():
    """Player kill tally. Add a kill by foe type (or custom name), or remove
    a manually-added entry. Kills the GM tracks via enemy cards carry an
    enemyId and cannot be removed here."""
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    body = request.get_json(silent=True) or {}
    p = _find_participant(battle, body.get('participantId'))
    if not p:
        return jsonify({'error': 'Participant not found'}), 404
    if session.get('role') != 'gm' and p.get('controlledBy') != session.get('username'):
        return jsonify({'error': 'You do not control this knight'}), 403
    ledger = p.setdefault('killLedger', [])

    remove_id = body.get('removeKillId')
    if remove_id:
        for i, k in enumerate(ledger):
            if k.get('killId') == remove_id:
                if k.get('enemyId'):
                    return jsonify({'error': 'That kill is tracked by the GM — ask them to undo it'}), 409
                ledger.pop(i)
                _save_active_battle(battle)
                return jsonify({'killLedger': ledger})
        return jsonify({'error': 'Kill not found'}), 404

    foe_id = body.get('foeId')
    custom = str(body.get('custom', '')).strip()[:60]
    if foe_id:
        foe = next((f for f in battle.get('foes', []) if f.get('foeId') == foe_id), None)
        if not foe:
            return jsonify({'error': 'Foe type not found in this battle'}), 404
        kill = {
            'type': foe.get('type', ''),
            'weapon': foe.get('weapon', ''),
            'glory': foe.get('glory', 0),
            'kv': foe.get('kv', 0),
        }
    elif custom:
        kill = {'type': custom, 'weapon': '', 'glory': 0, 'kv': 0}
    else:
        return jsonify({'error': 'Provide foeId or custom foe name'}), 422
    kill['killId'] = 'k_' + _secrets_mod.token_hex(8)
    kill['round'] = battle['currentRound']
    ledger.append(kill)
    _save_active_battle(battle)
    return jsonify({'kill': kill, 'killLedger': ledger})


@app.route('/api/battle/my-morale', methods=['POST'])
@login_required
@_with_battle_lock
def api_battle_my_morale():
    """Conroi commander's player only — adjust morale by delta (GM calls it out)."""
    err = _csrf_check()
    if err: return err
    battle = _get_active_battle()
    if not battle or battle['state'] != 'active':
        return jsonify({'error': 'No active battle in progress'}), 404
    cmdr = _find_participant(battle, battle.get('conroiCommanderId'))
    if session.get('role') != 'gm' and (
            not cmdr or cmdr.get('controlledBy') != session.get('username')):
        return jsonify({'error': 'Only the conroi commander may adjust morale'}), 403
    body = request.get_json(silent=True) or {}
    try:
        delta = int(body.get('delta'))
    except (ValueError, TypeError):
        return jsonify({'error': 'Delta must be an integer'}), 422
    if abs(delta) > 10:
        return jsonify({'error': 'Delta too large'}), 422
    m = battle['morale']
    m['current'] = min(m['starting'], max(0, m['current'] + delta))
    _save_active_battle(battle)
    return jsonify({'morale': m})


# ── NPC PURGE (LO-18) ─────────────────────────────────────────────────────────
# When the GM permanently deletes an NPC, wipe the data that lives outside
# binder-save.json: public comments, every player's private impressions on
# that NPC, and every player's pin on that NPC. Without this cascade, those
# files slowly fill with orphaned references to dead IDs.

@app.route('/api/npc/<npc_id>/purge', methods=['POST'])
@gm_required
def api_purge_npc(npc_id):
    err = _csrf_check()
    if err: return err
    if not isinstance(npc_id, str) or not npc_id:
        return jsonify({'error': 'npc_id is required'}), 400

    stats = {'comments': 0, 'impressions': 0, 'pins': 0, 'tree': 0}

    # 1. Comments — drop every comment whose npcId matches (replies too).
    with _comments_lock:
        all_comments = _read_comments()
        kept = [c for c in all_comments if c.get('npcId') != npc_id]
        dropped = len(all_comments) - len(kept)
        if dropped:
            _write_comments(kept)
            stats['comments'] = dropped

    # 2/3. Walk every player_data/<user>/ dir and scrub notes.impressions + pins.
    if PLAYER_DATA_DIR.exists():
        for user_dir in PLAYER_DATA_DIR.iterdir():
            if not user_dir.is_dir():
                continue
            uname = user_dir.name
            with _player_lock(uname):
                notes = _read_notes(uname)
                impressions = notes.get('impressions') or {}
                if npc_id in impressions:
                    del impressions[npc_id]
                    notes['impressions'] = impressions
                    _write_notes(uname, notes)
                    stats['impressions'] += 1
                pins = _read_pins(uname)
                if npc_id in pins:
                    _write_pins(uname, [p for p in pins if p != npc_id])
                    stats['pins'] += 1

    # 4. Binder save — scrub orphaned treePos / treeLock entries.
    # Client-side STORE.deleteNpc() drops the NPC from living/dead, but the
    # tree-display state dicts aren't keyed off the NPC list, so they leak.
    save_path = get_save_path()
    if save_path and save_path.exists():
        with _save_lock:
            save_data = _read_json(save_path, default={})
            changed = False
            for key in ('treePos', 'treeLock'):
                bucket = save_data.get(key)
                if isinstance(bucket, dict) and npc_id in bucket:
                    del bucket[npc_id]
                    stats['tree'] += 1
                    changed = True
            if changed:
                _write_json(save_path, save_data)

    log.info('NPC purge: %s → comments=%d impressions=%d pins=%d tree=%d',
             npc_id, stats['comments'], stats['impressions'], stats['pins'], stats['tree'])
    return jsonify({'ok': True, 'purged': stats})


# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

def _notifications_path(username: str) -> Path:
    return PLAYER_DATA_DIR / username / 'notifications.json'


def _read_notifications(username: str) -> list:
    """Returns notifications list (newest first)."""
    data = _read_json(_notifications_path(username), default=[])
    return data if isinstance(data, list) else []


def _push_notification(username: str, notif_type: str, text: str, link: str = '') -> None:
    """Append a notification to player_data/{username}/notifications.json. Cap at 50."""
    import secrets as _secrets
    with _player_lock(username):
        notifs = _read_notifications(username)
        notif = {
            'id':   'notif-' + _secrets.token_hex(6),
            'type': notif_type,
            'text': text,
            'link': link,
            'read': False,
            'ts':   datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z',
        }
        notifs.insert(0, notif)
        notifs = notifs[:50]
        _write_json(_notifications_path(username), notifs)


# ── PLAYER NPC EDIT (household-scoped) ────────────────────────────────────────

_PLAYER_NPC_UPDATABLE = ('name', 'pronoun', 'notes', 'passions', 'skills', 'stats')


@app.route('/api/npc/<npc_id>', methods=['PATCH'])
@login_required
def api_npc_household_update(npc_id):
    """Household-scoped NPC edit. Players may edit only NPCs in their own
    household, and only the _PLAYER_NPC_UPDATABLE fields. Every player edit
    pushes a notification to the GM(s) naming the changed fields."""
    err = _csrf_check()
    if err: return err
    is_gm = session.get('role') == 'gm'
    body = request.get_json(silent=True) or {}
    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 500
    with _save_lock:
        binder = json.loads(save_path.read_text(encoding='utf-8'))
        npc = next((n for n in binder.get('living', []) if n.get('id') == npc_id), None) \
           or next((n for n in binder.get('dead', []) if n.get('id') == npc_id), None)
        if npc is None:
            return jsonify({'error': 'NPC not found'}), 404
        if not is_gm:
            user_hh = (session.get('household') or '').lower()
            if not user_hh:
                return jsonify({'error': 'No household assigned'}), 403
            if (npc.get('household') or '').lower() != user_hh:
                return jsonify({'error': 'You may only edit members of your own household'}), 403
        changed = []
        for field in _PLAYER_NPC_UPDATABLE:
            if field not in body:
                continue
            val = body[field]
            if not isinstance(val, str):
                return jsonify({'error': f'{field} must be a string'}), 422
            limit = 5000 if field in ('notes', 'passions', 'skills', 'stats') else 200
            val = val.strip()[:limit]
            if field == 'name' and not val:
                return jsonify({'error': 'Name cannot be empty'}), 422
            if (npc.get(field) or '') != val:
                npc[field] = val
                changed.append(field)
        if changed:
            _rotate_backup(save_path)
            _atomic_write(save_path, json.dumps(binder, indent=2))
    if changed and not is_gm:
        text = f"{session['username']} edited {npc.get('name', npc_id)} — {', '.join(changed)}"
        for u in load_users():
            if u.get('role') == 'gm':
                _push_notification(u['username'], 'npc_edit', text, npc_id)
    if changed:
        log.info('NPC %s edited by %s (%s)', npc_id, session['username'], ', '.join(changed))
    resp_npc = {k: v for k, v in npc.items() if is_gm or k != 'statblock_template'}
    return jsonify({'ok': True, 'changed': changed, 'npc': resp_npc})


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
    with _player_lock(username):
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

        _write_json(_notifications_path(username), notifs)
    return jsonify({'ok': True})


# ── USER MANAGEMENT API ──────────────────────────────────────────────────────

@app.route('/api/users')
@gm_required
def api_get_users():
    users = load_users()
    result = []
    for u in users:
        result.append({
            'username':  u['username'],
            'role':      u['role'],
            'household': u.get('household') or '',
            'email':     u.get('email') or '',
            'lastLogin': u.get('lastLogin') or None,
        })
    return jsonify(result)


@app.route('/api/users', methods=['POST'])
@gm_required
def api_create_user():
    err = _csrf_check()
    if err: return err
    data = request.get_json(force=True, silent=True) or {}
    username  = (data.get('username') or '').strip()
    password  = data.get('password', '')
    role      = (data.get('role') or '').strip()
    household = (data.get('household') or '').strip() or None
    email     = (data.get('email') or '').strip() or None

    if not re.match(r'^[\w\-]{3,30}$', username):
        return jsonify({'error': 'Username must be 3-30 chars, alphanumeric/underscore/hyphen only.'}), 400
    if len(password) < 10:
        return jsonify({'error': 'Password must be at least 10 characters.'}), 400
    if role not in ('gm', 'player', 'observer'):
        return jsonify({'error': 'Role must be gm, player, or observer.'}), 400
    if email and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({'error': 'Invalid email format.'}), 400

    with _users_lock:
        users = load_users()
        if any(u['username'].lower() == username.lower() for u in users):
            return jsonify({'error': 'Username already taken.'}), 400

        new_user = {
            'username':      username,
            'role':          role,
            'household':     household,
            'email':         email or '',
            'password_hash': generate_password_hash(password),
        }
        users.append(new_user)
        save_users(users)
    return jsonify({'ok': True, 'user': {
        'username': username, 'role': role, 'household': household or '', 'email': email or '',
    }})


@app.route('/api/users/<target_username>', methods=['PATCH'])
@gm_required
def api_update_user(target_username):
    err = _csrf_check()
    if err: return err
    data  = request.get_json(force=True, silent=True) or {}
    with _users_lock:
        users = load_users()
        target = next((u for u in users if u['username'].lower() == target_username.lower()), None)
        if not target:
            return jsonify({'error': 'User not found.'}), 404

        if 'username' in data:
            new_uname = data['username'].strip()
            if not re.match(r'^[A-Za-z0-9_-]{3,30}$', new_uname):
                return jsonify({'error': 'Username must be 3–30 characters (letters, numbers, _ -)'}), 400
            if any(u['username'].lower() == new_uname.lower() and u is not target for u in users):
                return jsonify({'error': 'That username is already taken.'}), 409
            old_uname = target['username']
            target['username'] = new_uname
            # Rename player_data directory if it exists
            old_dir = PLAYER_DATA_DIR / old_uname
            new_dir = PLAYER_DATA_DIR / new_uname
            if old_dir.exists() and not new_dir.exists():
                old_dir.rename(new_dir)

        if 'role' in data:
            new_role = data['role']
            if new_role not in ('gm', 'player', 'observer'):
                return jsonify({'error': 'Role must be gm, player, or observer.'}), 400
            if target['username'].lower() == session['username'].lower():
                return jsonify({'error': 'Cannot change your own role.'}), 400
            gm_count = sum(1 for u in users if u['role'] == 'gm')
            if target['role'] == 'gm' and new_role != 'gm' and gm_count <= 1:
                return jsonify({'error': 'Cannot remove the last GM.'}), 400
            target['role'] = new_role

        if 'email' in data:
            email = (data['email'] or '').strip()
            if email and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                return jsonify({'error': 'Invalid email format.'}), 400
            target['email'] = email

        if 'household' in data:
            hh = (data['household'] or '').strip() or None
            if hh:
                # Validate against actual manor keys in the save file
                try:
                    save_path = get_save_path()
                    save_data = json.loads(save_path.read_text(encoding='utf-8')) if save_path and save_path.exists() else {}
                    valid_keys = [k.lower() for k in save_data.get('manors', {}).keys()]
                    if hh.lower() not in valid_keys:
                        return jsonify({'error': f'"{hh}" is not a known manor. Choose from: {", ".join(save_data.get("manors", {}).keys())}'}), 400
                    # Use the canonical casing from the save file
                    hh = next(k for k in save_data.get('manors', {}).keys() if k.lower() == hh.lower())
                except Exception:
                    pass  # If we can't validate, allow it through
            target['household'] = hh

        save_users(users)
    return jsonify({'ok': True})


@app.route('/api/users/<target_username>/reset-password', methods=['POST'])
@gm_required
def api_admin_reset_password(target_username):
    err = _csrf_check()
    if err: return err
    users = load_users()
    target = next((u for u in users if u['username'].lower() == target_username.lower()), None)
    if not target:
        return jsonify({'error': 'User not found.'}), 404
    email = (target.get('email') or '').strip()
    if not email:
        return jsonify({'error': 'No email on file for this user. Set their email first.'}), 400
    token = _secrets_mod.token_urlsafe(32)
    with _reset_tokens_lock:
        _reset_tokens[token] = {'username': target['username'], 'expires': time.time() + 3600}
    if SECRETS.get('CF_TUNNEL'):
        base_url = 'https://pendragon-binder.com'
    else:
        base_url = request.host_url.rstrip('/')
    threading.Thread(
        target=_send_reset_email,
        args=(email, token, base_url),
        daemon=True,
    ).start()
    return jsonify({'ok': True, 'sent_to': email})


@app.route('/api/users/<target_username>', methods=['DELETE'])
@gm_required
def api_delete_user(target_username):
    err = _csrf_check()
    if err: return err
    if target_username.lower() == session['username'].lower():
        return jsonify({'error': 'Cannot delete your own account.'}), 400
    with _users_lock:
        users = load_users()
        target = next((u for u in users if u['username'].lower() == target_username.lower()), None)
        if not target:
            return jsonify({'error': 'User not found.'}), 404
        if target['role'] == 'gm':
            gm_count = sum(1 for u in users if u['role'] == 'gm')
            if gm_count <= 1:
                return jsonify({'error': 'Cannot delete the last GM.'}), 400
        users = [u for u in users if u['username'].lower() != target_username.lower()]
        save_users(users)
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
        log.warning('[Backup] %s', e)


def _rotate_battle_backup() -> None:
    try:
        if not BATTLE_FILE.exists():
            return
        BACKUP_DIR.mkdir(exist_ok=True)
        stamp  = datetime.now().strftime('%Y%m%d_%H%M%S')
        target = BACKUP_DIR / f'battle-state_{stamp}.json'
        shutil.copy2(BATTLE_FILE, target)
        backups = sorted(BACKUP_DIR.glob('battle-state_*.json'))
        for old in backups[:-5]:
            old.unlink()
    except Exception as e:
        log.warning('[Backup] %s', e)

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


# ── BOT API (read-only, Bearer token auth) ────────────────────────────────────

_BOT_NPC_FIELDS = ('id', 'name', 'role', 'household', 'status',
                   'year_born', 'year_died', 'pronoun', 'manor', 'faction', 'glory', 'notes')

_REL_CLOSENESS = {
    'Spouse': 0, 'Parent': 1, 'Child': 2, 'Sibling': 3,
    'Bastard': 4, 'Adopted Child': 5, 'Ward': 6,
    'Squire': 7, 'Former Squire': 8,
    'Aunt/Uncle': 9, 'Niece/Nephew': 10, 'Vassal': 11,
}

def _safe_npc(npc: dict) -> dict:
    return {k: npc.get(k) for k in _BOT_NPC_FIELDS}

def _npc_relationships(npc_id: str, all_npcs: list, all_rels: list, limit: int = 4) -> list:
    """Return up to `limit` relationships for an NPC, sorted by closeness."""
    id_to_name = {n.get('id'): n.get('name', '?') for n in all_npcs if n.get('id')}
    matched = []
    for rel in all_rels:
        src, tgt, rtype = rel.get('sourceId'), rel.get('targetId'), rel.get('type', '')
        if src == npc_id:
            matched.append((_REL_CLOSENESS.get(rtype, 99), rtype, id_to_name.get(tgt, tgt)))
        elif tgt == npc_id:
            matched.append((_REL_CLOSENESS.get(rtype, 99), rtype, id_to_name.get(src, src)))
    matched.sort(key=lambda x: x[0])
    return [{'type': rtype, 'name': name} for _, rtype, name in matched[:limit]]

def _load_binder() -> dict | None:
    path = get_save_path()
    return _read_json(path, default=None) if path else None

@app.route('/api/bot/status')
@bot_required
def api_bot_status():
    return jsonify({'ok': True, 'version': APP_VERSION})

@app.route('/api/bot/world')
@bot_required
def api_bot_world():
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    year   = binder.get('year')
    manors = list(binder.get('manors', {}).keys())
    return jsonify({'year': year, 'manors': manors})

def _all_npcs(binder: dict) -> list:
    """Return combined living + dead NPC list from save structure."""
    living = binder.get('living', [])
    dead   = binder.get('dead', [])
    if isinstance(living, dict):
        living = list(living.values())
    if isinstance(dead, dict):
        dead = list(dead.values())
    return living + dead

@app.route('/api/bot/npcs')
@bot_required
def api_bot_npcs():
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    npcs = [_safe_npc(n) for n in _all_npcs(binder)]
    return jsonify({'npcs': npcs})

@app.route('/api/bot/npc/<name_or_id>')
@bot_required
def api_bot_npc(name_or_id):
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    all_npcs = _all_npcs(binder)
    all_rels = binder.get('relationships', [])
    needle = name_or_id.lower()
    for npc in all_npcs:
        if (npc.get('id') or '').lower() == needle or (npc.get('name') or '').lower() == needle:
            result = _safe_npc(npc)
            result['relationships'] = _npc_relationships(npc.get('id', ''), all_npcs, all_rels)
            return jsonify(result)
    return jsonify({'error': 'NPC not found'}), 404

@app.route('/api/bot/chronicle')
@bot_required
def api_bot_chronicle():
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    chronicle = binder.get('chronicle', {})
    numeric_keys = []
    for y in chronicle.keys():
        try:
            numeric_keys.append((int(y), y))
        except (ValueError, TypeError):
            continue
    recent_years = [k for _, k in sorted(numeric_keys, reverse=True)[:3]]
    entries = [{'year': int(y), 'entries': chronicle[y]} for y in recent_years]
    return jsonify({'chronicle': entries})

# ── STORY ARCS & SESSION PREP ────────────────────────────────────────────────

_arcs_lock = threading.Lock()
_prep_lock = threading.Lock()

_ARC_STATUSES  = ('active', 'cold', 'complete')
_OBJ_STATUSES  = ('active', 'pending', 'complete')
_PREP_STATUSES = ('draft', 'ready', 'played')

def _read_arcs() -> list:
    return _read_json(ARCS_FILE, default=[]) or []

def _write_arcs(arcs: list) -> None:
    _write_json(ARCS_FILE, arcs)

def _read_preps() -> list:
    return _read_json(SESSION_PREP_FILE, default=[]) or []

def _write_preps(preps: list) -> None:
    _write_json(SESSION_PREP_FILE, preps)

# ── Arc CRUD ─────────────────────────────────────────────────────────────────

@app.route('/api/arcs')
def api_list_arcs():
    err = _auth_gm_or_mcp_read()
    if err: return err
    arcs = _read_arcs()
    status_filter = request.args.get('status')
    if status_filter:
        arcs = [a for a in arcs if a.get('status') == status_filter]
    return jsonify({'arcs': arcs})

@app.route('/api/arcs/<arc_id>')
def api_get_arc(arc_id):
    err = _auth_gm_or_mcp_read()
    if err: return err
    arcs = _read_arcs()
    arc = next((a for a in arcs if a.get('id') == arc_id), None)
    if not arc:
        return jsonify({'error': 'Arc not found'}), 404
    return jsonify({'arc': arc})

@app.route('/api/arcs', methods=['POST'])
def api_create_arc():
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    title = data.get('title', '')
    if not isinstance(title, str) or not title.strip():
        return jsonify({'error': 'title is required'}), 400

    status = data.get('status', 'active')
    if status not in _ARC_STATUSES:
        return jsonify({'error': f'status must be one of {_ARC_STATUSES}'}), 400

    raw_id = data.get('id')
    arc_id = str(raw_id)[:80] if raw_id else ('arc_' + _secrets_mod.token_hex(8))
    arc = {
        'id':             arc_id,
        'title':          title.strip()[:200],
        'status':         status,
        'created':        str(data.get('created', ''))[:40],
        'last_advanced':  str(data.get('last_advanced', ''))[:40],
        'summary':        str(data.get('summary', ''))[:4000],
        'linked_npcs':    data.get('linked_npcs', []),
        'objectives':     data.get('objectives', []),
        'timeline':       data.get('timeline', []),
        'notes':          str(data.get('notes', ''))[:10000],
    }

    with _arcs_lock:
        arcs = _read_arcs()
        if any(a.get('id') == arc_id for a in arcs):
            return jsonify({'error': 'Arc ID already exists'}), 409
        arcs.append(arc)
        _write_arcs(arcs)

    log.info('[Arcs] Created arc %s: %s', arc_id, arc['title'])
    return jsonify({'ok': True, 'id': arc_id, 'arc': arc}), 201

@app.route('/api/arcs/<arc_id>', methods=['PUT'])
def api_update_arc(arc_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    if 'status' in data and data['status'] not in _ARC_STATUSES:
        return jsonify({'error': f'status must be one of {_ARC_STATUSES}'}), 400

    updatable = ('title', 'status', 'summary', 'notes', 'created',
                 'last_advanced', 'linked_npcs', 'objectives', 'timeline')

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        for key in updatable:
            if key in data:
                arc[key] = data[key]
        _write_arcs(arcs)

    log.info('[Arcs] Updated arc %s', arc_id)
    return jsonify({'ok': True, 'arc': arc})

@app.route('/api/arcs/<arc_id>', methods=['DELETE'])
def api_delete_arc(arc_id):
    err = _auth_gm_or_mcp()
    if err: return err

    with _arcs_lock:
        arcs = _read_arcs()
        original_len = len(arcs)
        arcs = [a for a in arcs if a.get('id') != arc_id]
        if len(arcs) == original_len:
            return jsonify({'error': 'Arc not found'}), 404
        _write_arcs(arcs)

    log.info('[Arcs] Deleted arc %s', arc_id)
    return jsonify({'ok': True, 'deleted': arc_id})

# ── Arc Sub-Resources ────────────────────────────────────────────────────────

@app.route('/api/arcs/<arc_id>/objectives', methods=['POST'])
def api_add_objective(arc_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    text = data.get('text', '')
    if not isinstance(text, str) or not text.strip():
        return jsonify({'error': 'text is required'}), 400

    status = data.get('status', 'active')
    if status not in _OBJ_STATUSES:
        return jsonify({'error': f'status must be one of {_OBJ_STATUSES}'}), 400

    obj_id = 'obj_' + _secrets_mod.token_hex(8)
    objective = {
        'id':        obj_id,
        'text':      text.strip()[:2000],
        'status':    status,
        'completed': data.get('completed'),
        'notes':     str(data.get('notes', ''))[:2000],
    }

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        arc.setdefault('objectives', []).append(objective)
        _write_arcs(arcs)

    log.info('[Arcs] Added objective %s to arc %s', obj_id, arc_id)
    return jsonify({'ok': True, 'id': obj_id, 'objective': objective}), 201

@app.route('/api/arcs/<arc_id>/objectives/<obj_id>', methods=['PUT'])
def api_update_objective(arc_id, obj_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    if 'status' in data and data['status'] not in _OBJ_STATUSES:
        return jsonify({'error': f'status must be one of {_OBJ_STATUSES}'}), 400

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        obj = next((o for o in arc.get('objectives', []) if o.get('id') == obj_id), None)
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        for key in ('text', 'status', 'completed', 'notes'):
            if key in data:
                obj[key] = data[key]
        _write_arcs(arcs)

    log.info('[Arcs] Updated objective %s in arc %s', obj_id, arc_id)
    return jsonify({'ok': True, 'objective': obj})

@app.route('/api/arcs/<arc_id>/objectives/<obj_id>', methods=['DELETE'])
def api_delete_objective(arc_id, obj_id):
    err = _auth_gm_or_mcp()
    if err: return err

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        objs = arc.get('objectives', [])
        original_len = len(objs)
        arc['objectives'] = [o for o in objs if o.get('id') != obj_id]
        if len(arc['objectives']) == original_len:
            return jsonify({'error': 'Objective not found'}), 404
        _write_arcs(arcs)

    log.info('[Arcs] Deleted objective %s from arc %s', obj_id, arc_id)
    return jsonify({'ok': True, 'deleted': obj_id})

@app.route('/api/arcs/<arc_id>/timeline', methods=['POST'])
def api_add_timeline(arc_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    year = data.get('year', '')
    if not isinstance(year, str) or not year.strip():
        return jsonify({'error': 'year is required (e.g. "502-spring")'}), 400

    description = data.get('description', '')
    if not isinstance(description, str) or not description.strip():
        return jsonify({'error': 'description is required'}), 400

    entry = {
        'year':        year.strip()[:40],
        'session_id':  str(data.get('session_id', ''))[:40],
        'description': description.strip()[:4000],
    }

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        arc.setdefault('timeline', []).append(entry)
        arc['last_advanced'] = entry['year']
        _write_arcs(arcs)

    log.info('[Arcs] Added timeline entry to arc %s: %s', arc_id, entry['year'])
    return jsonify({'ok': True, 'entry': entry}), 201

@app.route('/api/arcs/<arc_id>/npcs', methods=['POST'])
def api_link_npc(arc_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    npc_id = data.get('npc_id', '')
    if not isinstance(npc_id, str) or not npc_id.strip():
        return jsonify({'error': 'npc_id is required'}), 400

    role = str(data.get('role', ''))[:100]
    link = {'npc_id': npc_id.strip(), 'role': role}

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        existing = arc.setdefault('linked_npcs', [])
        if any(n.get('npc_id') == npc_id.strip() for n in existing):
            return jsonify({'error': 'NPC already linked to this arc'}), 409
        existing.append(link)
        _write_arcs(arcs)

    log.info('[Arcs] Linked NPC %s to arc %s', npc_id.strip(), arc_id)
    return jsonify({'ok': True, 'link': link}), 201

@app.route('/api/arcs/<arc_id>/npcs/<npc_id>', methods=['DELETE'])
def api_unlink_npc(arc_id, npc_id):
    err = _auth_gm_or_mcp()
    if err: return err

    with _arcs_lock:
        arcs = _read_arcs()
        arc = next((a for a in arcs if a.get('id') == arc_id), None)
        if not arc:
            return jsonify({'error': 'Arc not found'}), 404
        npcs = arc.get('linked_npcs', [])
        original_len = len(npcs)
        arc['linked_npcs'] = [n for n in npcs if n.get('npc_id') != npc_id]
        if len(arc['linked_npcs']) == original_len:
            return jsonify({'error': 'NPC not linked to this arc'}), 404
        _write_arcs(arcs)

    log.info('[Arcs] Unlinked NPC %s from arc %s', npc_id, arc_id)
    return jsonify({'ok': True, 'unlinked': npc_id})

# ── Session Prep CRUD ────────────────────────────────────────────────────────

@app.route('/api/prep')
def api_list_preps():
    err = _auth_gm_or_mcp_read()
    if err: return err
    preps = _read_preps()
    status_filter = request.args.get('status')
    if status_filter:
        preps = [p for p in preps if p.get('status') == status_filter]
    return jsonify({'preps': preps})

@app.route('/api/prep/current')
def api_current_prep():
    err = _auth_gm_or_mcp_read()
    if err: return err
    preps = _read_preps()
    candidates = [p for p in preps if p.get('status') in ('draft', 'ready')]
    if not candidates:
        return jsonify({'error': 'No current prep found'}), 404
    candidates.sort(key=lambda p: p.get('session_number', 0), reverse=True)
    return jsonify({'prep': candidates[0]})

@app.route('/api/prep/<prep_id>')
def api_get_prep(prep_id):
    err = _auth_gm_or_mcp_read()
    if err: return err
    preps = _read_preps()
    prep = next((p for p in preps if p.get('id') == prep_id), None)
    if not prep:
        return jsonify({'error': 'Prep not found'}), 404
    return jsonify({'prep': prep})

@app.route('/api/prep', methods=['POST'])
def api_create_prep():
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    session_number = data.get('session_number')
    if session_number is None:
        return jsonify({'error': 'session_number is required'}), 400
    try:
        session_number = int(session_number)
    except (ValueError, TypeError):
        return jsonify({'error': 'session_number must be a number'}), 400

    status = data.get('status', 'draft')
    if status not in _PREP_STATUSES:
        return jsonify({'error': f'status must be one of {_PREP_STATUSES}'}), 400

    raw_id = data.get('id')
    prep_id = str(raw_id)[:80] if raw_id else ('prep_' + _secrets_mod.token_hex(8))
    prep = {
        'id':                  prep_id,
        'session_number':      session_number,
        'game_year':           str(data.get('game_year', ''))[:40],
        'location':            str(data.get('location', ''))[:200],
        'status':              status,
        'previous_session_id': str(data.get('previous_session_id', ''))[:40],
        'previously':          str(data.get('previously', ''))[:10000],
        'arcs_in_play':        data.get('arcs_in_play', []),
        'npcs_staged':         data.get('npcs_staged', []),
        'open_questions':      data.get('open_questions', []),
        'gm_notes':            data.get('gm_notes', []),
    }

    with _prep_lock:
        preps = _read_preps()
        if any(p.get('id') == prep_id for p in preps):
            return jsonify({'error': 'Prep ID already exists'}), 409
        preps.append(prep)
        _write_preps(preps)

    log.info('[Prep] Created prep %s for session %s', prep_id, session_number)
    return jsonify({'ok': True, 'id': prep_id, 'prep': prep}), 201

@app.route('/api/prep/<prep_id>', methods=['PUT'])
def api_update_prep(prep_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    if 'status' in data and data['status'] not in _PREP_STATUSES:
        return jsonify({'error': f'status must be one of {_PREP_STATUSES}'}), 400

    updatable = ('session_number', 'game_year', 'location', 'status',
                 'previous_session_id', 'previously', 'arcs_in_play',
                 'npcs_staged', 'open_questions', 'gm_notes')

    with _prep_lock:
        preps = _read_preps()
        prep = next((p for p in preps if p.get('id') == prep_id), None)
        if not prep:
            return jsonify({'error': 'Prep not found'}), 404
        for key in updatable:
            if key in data:
                prep[key] = data[key]
        _write_preps(preps)

    log.info('[Prep] Updated prep %s', prep_id)
    return jsonify({'ok': True, 'prep': prep})

@app.route('/api/prep/<prep_id>', methods=['DELETE'])
def api_delete_prep(prep_id):
    err = _auth_gm_or_mcp()
    if err: return err

    with _prep_lock:
        preps = _read_preps()
        original_len = len(preps)
        preps = [p for p in preps if p.get('id') != prep_id]
        if len(preps) == original_len:
            return jsonify({'error': 'Prep not found'}), 404
        _write_preps(preps)

    log.info('[Prep] Deleted prep %s', prep_id)
    return jsonify({'ok': True, 'deleted': prep_id})

# ── Reverse Lookups ──────────────────────────────────────────────────────────

@app.route('/api/npcs/<npc_id>/arcs')
def api_npc_arcs(npc_id):
    err = _auth_gm_or_mcp_read()
    if err: return err
    arcs = _read_arcs()
    linked = [a for a in arcs if any(n.get('npc_id') == npc_id for n in a.get('linked_npcs', []))]
    return jsonify({'arcs': linked})

@app.route('/api/chronicles/<year>/arcs')
def api_chronicle_arcs(year):
    err = _auth_gm_or_mcp_read()
    if err: return err
    arcs = _read_arcs()
    matched = [a for a in arcs if any(t.get('year') == year for t in a.get('timeline', []))]
    return jsonify({'arcs': matched})

# ── MCP Read API ─────────────────────────────────────────────────────────────

@app.route('/api/mcp/npcs')
@mcp_required
def api_mcp_npcs():
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    search = request.args.get('search', '').lower()
    npcs = [_safe_npc(n) for n in _all_npcs(binder)]
    if search:
        npcs = [n for n in npcs if search in (n.get('name') or '').lower()]
    return jsonify({'npcs': npcs})

@app.route('/api/mcp/npc/<name_or_id>')
@mcp_required
def api_mcp_npc(name_or_id):
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    all_npcs = _all_npcs(binder)
    all_rels = binder.get('relationships', [])
    needle = name_or_id.lower()
    for npc in all_npcs:
        if (npc.get('id') or '').lower() == needle or (npc.get('name') or '').lower() == needle:
            result = _safe_npc(npc)
            result['relationships'] = _npc_relationships(npc.get('id', ''), all_npcs, all_rels)
            return jsonify(result)
    return jsonify({'error': 'NPC not found'}), 404

@app.route('/api/mcp/chronicle')
@mcp_required
def api_mcp_chronicle():
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    chronicle = binder.get('chronicle', {})
    limit = request.args.get('limit', '5')
    try:
        limit = min(int(limit), 50)
    except ValueError:
        limit = 5
    numeric_keys = []
    for y in chronicle.keys():
        try:
            numeric_keys.append((int(y), y))
        except (ValueError, TypeError):
            continue
    recent_years = [k for _, k in sorted(numeric_keys, reverse=True)[:limit]]
    entries = [{'year': int(y), 'entries': chronicle[y]} for y in recent_years]
    return jsonify({'chronicle': entries})

@app.route('/api/mcp/binder-summary')
@mcp_required
def api_mcp_binder_summary():
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    arcs = _read_arcs()
    active_arcs = [a for a in arcs if a.get('status') == 'active']
    return jsonify({
        'year':             binder.get('year'),
        'npc_count':        len(_all_npcs(binder)),
        'living_count':     len(binder.get('living', [])),
        'dead_count':       len(binder.get('dead', [])),
        'household_count':  len(binder.get('households', [])),
        'manor_count':      len(binder.get('manors', {})),
        'active_arc_count': len(active_arcs),
    })

# ── MCP Write API — NPC & Chronicle mutations ───────────────────────────────

_MCP_NPC_UPDATABLE = (
    'name', 'role', 'household', 'status', 'year_born', 'year_died',
    'pronoun', 'manor', 'faction', 'glory', 'notes', 'eligibility', 'dowry',
    'passions', 'skills', 'stats', 'con', 'blessed', 'blessed_note',
    'barren', 'fate_touched', 'out_of_story', 'out_of_story_note',
    'round_table', 'statblock_template',
    'page_placed', 'page_court', 'page_type',
    'training_path', 'training_where', 'training_npc_id', 'came_of_age',
)


@app.route('/api/mcp/npc', methods=['POST'])
def api_mcp_create_npc():
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    name = data.get('name', '')
    if not isinstance(name, str) or not name.strip():
        return jsonify({'error': 'name is required'}), 400

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        living = binder.get('living', [])
        dead = binder.get('dead', [])
        if isinstance(living, dict):
            living = list(living.values())
        if isinstance(dead, dict):
            dead = list(dead.values())

        existing_ids = {n.get('id') for n in living + dead if n.get('id')}
        npc_num = 1
        while f'npc-{npc_num:03d}' in existing_ids:
            npc_num += 1
        npc_id = f'npc-{npc_num:03d}'

        npc = {
            'id': npc_id,
            'name': name.strip()[:200],
            'role': str(data.get('role', ''))[:100],
            'household': str(data.get('household', ''))[:100],
            'status': str(data.get('status', 'Alive'))[:40],
            'year_born': data.get('year_born'),
            'year_died': data.get('year_died'),
            'age': None,
            'pronoun': str(data.get('pronoun', ''))[:40],
            'manor': str(data.get('manor', ''))[:200],
            'faction': str(data.get('faction', ''))[:100],
            'glory': data.get('glory', 0),
            'notes': str(data.get('notes', ''))[:10000],
            'eligibility': str(data.get('eligibility', ''))[:200],
            'dowry': str(data.get('dowry', ''))[:200],
            'passions': str(data.get('passions', ''))[:4000],
            'skills': str(data.get('skills', ''))[:4000],
            'stats': str(data.get('stats', ''))[:4000],
            'blessed': bool(data.get('blessed', False)),
            'blessed_note': str(data.get('blessed_note', ''))[:500],
            'con': data.get('con'),
            'barren': bool(data.get('barren', False)),
            'fate_touched': bool(data.get('fate_touched', False)),
            'out_of_story': bool(data.get('out_of_story', False)),
            'out_of_story_note': str(data.get('out_of_story_note', ''))[:500],
            'round_table': bool(data.get('round_table', False)),
            'statblock_template': str(data.get('statblock_template', ''))[:100],
            'page_placed': data.get('page_placed', False),
            'page_court': str(data.get('page_court', ''))[:200],
            'page_type': str(data.get('page_type', ''))[:40],
            'training_path': str(data.get('training_path', ''))[:40],
            'training_where': str(data.get('training_where', ''))[:200],
            'training_npc_id': str(data.get('training_npc_id', ''))[:40],
            'came_of_age': data.get('came_of_age', False),
            'retired': False,
            'treeX': None,
            'treeY': None,
        }

        living.append(npc)
        binder['living'] = living
        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Created NPC %s: %s', npc_id, npc['name'])
    return jsonify({'ok': True, 'id': npc_id, 'npc': _safe_npc(npc)}), 201


@app.route('/api/mcp/npc/<npc_id>', methods=['PATCH'])
def api_mcp_update_npc(npc_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        living = binder.get('living', [])
        dead = binder.get('dead', [])
        if isinstance(living, dict):
            living = list(living.values())
        if isinstance(dead, dict):
            dead = list(dead.values())

        npc = None
        source_list = None
        for lst_name, lst in [('living', living), ('dead', dead)]:
            for n in lst:
                if n.get('id') == npc_id:
                    npc = n
                    source_list = lst_name
                    break
            if npc:
                break

        if not npc:
            return jsonify({'error': 'NPC not found'}), 404

        _STR_LIMITS = {
            'name': 200, 'role': 100, 'household': 100, 'status': 50,
            'pronoun': 50, 'manor': 200, 'faction': 100, 'notes': 5000,
            'eligibility': 100, 'dowry': 200, 'passions': 3000,
            'skills': 3000, 'stats': 3000, 'blessed_note': 500,
            'out_of_story_note': 500, 'statblock_template': 100,
            'page_court': 200, 'page_type': 50, 'training_path': 50,
            'training_where': 200, 'training_npc_id': 50,
        }
        changed = []
        for key in _MCP_NPC_UPDATABLE:
            if key in data:
                val = data[key]
                if key in _STR_LIMITS and isinstance(val, str):
                    val = val[:_STR_LIMITS[key]]
                npc[key] = val
                changed.append(key)

        if not changed:
            return jsonify({'error': 'No updatable fields provided'}), 400

        old_status = 'dead' if source_list == 'dead' else 'alive'
        new_status = str(npc.get('status', 'Alive')).lower()
        needs_move = (old_status == 'alive' and new_status == 'dead') or \
                     (old_status == 'dead' and new_status != 'dead')

        if needs_move:
            if old_status == 'alive' and new_status == 'dead':
                living = [n for n in living if n.get('id') != npc_id]
                dead.append(npc)
            elif old_status == 'dead' and new_status != 'dead':
                dead = [n for n in dead if n.get('id') != npc_id]
                living.append(npc)

        binder['living'] = living
        binder['dead'] = dead
        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Updated NPC %s: %s', npc_id, ', '.join(changed))
    return jsonify({'ok': True, 'id': npc_id, 'changed': changed, 'npc': _safe_npc(npc)})


_VALID_REL_TYPES = {
    'Spouse', 'Betrothed', 'Lover', 'Former Spouse',
    'Child', 'Adopted Child', 'Bastard', 'Parent', 'Adoptive Parent',
    'Sibling', 'Half-Sibling', 'Aunt/Uncle', 'Niece/Nephew', 'Cousin',
    'Grandparent', 'Grandchild', 'Sworn Brother/Sister',
    'Squire', 'Former Squire', 'Page', 'Vassal', 'Ward', 'Guardian', 'Other',
}


@app.route('/api/mcp/relationship', methods=['POST'])
def api_mcp_add_relationship():
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    source_id = data.get('sourceId', '')
    target_id = data.get('targetId', '')
    rel_type = data.get('type', '')
    notes = str(data.get('notes', ''))[:500]

    if not source_id or not target_id:
        return jsonify({'error': 'sourceId and targetId are required'}), 400
    if rel_type not in _VALID_REL_TYPES:
        return jsonify({'error': f'Invalid type. Valid: {sorted(_VALID_REL_TYPES)}'}), 400

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        all_npcs = _all_npcs(binder)
        npc_ids = {n.get('id') for n in all_npcs}
        if source_id not in npc_ids:
            return jsonify({'error': f'sourceId {source_id} not found'}), 404
        if target_id not in npc_ids:
            return jsonify({'error': f'targetId {target_id} not found'}), 404

        rels = binder.get('relationships', [])
        for r in rels:
            if r.get('sourceId') == source_id and r.get('targetId') == target_id and r.get('type') == rel_type:
                return jsonify({'error': 'Relationship already exists'}), 409

        rel = {
            'id': 'rel-' + str(uuid.uuid4()),
            'sourceId': source_id,
            'targetId': target_id,
            'type': rel_type,
        }
        if notes:
            rel['notes'] = notes
        rels.append(rel)
        binder['relationships'] = rels
        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Added relationship %s -> %s (%s)', source_id, target_id, rel_type)
    return jsonify({'ok': True, 'relationship': rel}), 201


@app.route('/api/mcp/relationship/<rel_id>', methods=['DELETE'])
def api_mcp_delete_relationship(rel_id):
    err = _auth_gm_or_mcp()
    if err: return err

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        rels = binder.get('relationships', [])
        before = len(rels)
        binder['relationships'] = [r for r in rels if r.get('id') != rel_id]
        if len(binder['relationships']) == before:
            return jsonify({'error': 'Relationship not found'}), 404
        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Deleted relationship %s', rel_id)
    return jsonify({'ok': True, 'deleted': rel_id})


@app.route('/api/mcp/npc/<npc_id>/relationships', methods=['GET'])
def api_mcp_npc_relationships(npc_id):
    err = _auth_gm_or_mcp_read()
    if err: return err
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    all_npcs = _all_npcs(binder)
    all_rels = binder.get('relationships', [])
    id_to_name = {n.get('id'): n.get('name', '?') for n in all_npcs if n.get('id')}
    if npc_id not in id_to_name:
        return jsonify({'error': 'NPC not found'}), 404
    matched = []
    for rel in all_rels:
        src, tgt = rel.get('sourceId'), rel.get('targetId')
        if src == npc_id or tgt == npc_id:
            matched.append({
                'id': rel.get('id', ''),
                'sourceId': src,
                'sourceName': id_to_name.get(src, src),
                'targetId': tgt,
                'targetName': id_to_name.get(tgt, tgt),
                'type': rel.get('type', ''),
                'notes': rel.get('notes', ''),
            })
    return jsonify({'npc_id': npc_id, 'relationships': matched})


@app.route('/api/mcp/npc/<npc_id>/events', methods=['GET'])
def api_mcp_npc_events(npc_id):
    err = _auth_gm_or_mcp_read()
    if err: return err
    binder = _load_binder()
    if binder is None:
        return jsonify({'error': 'Save file not found'}), 503
    for npc in _all_npcs(binder):
        if npc.get('id') == npc_id:
            return jsonify({'npc_id': npc_id, 'name': npc.get('name', ''), 'events': npc.get('soloEvents', [])})
    return jsonify({'error': 'NPC not found'}), 404


@app.route('/api/mcp/npc/<npc_id>/events', methods=['POST'])
def api_mcp_add_event(npc_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    title = str(data.get('title', ''))[:200]
    if not title.strip():
        return jsonify({'error': 'title is required'}), 400

    event = {
        'id':         'evt-' + str(uuid.uuid4()),
        'year':       data.get('year'),
        'season':     str(data.get('season', ''))[:20],
        'title':      title,
        'mechDesc':   str(data.get('mechDesc', ''))[:2000],
        'flavorText': data.get('flavorText'),
        'userNotes':  str(data.get('userNotes', ''))[:2000],
    }

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        npc = None
        for lst in [binder.get('living', []), binder.get('dead', [])]:
            for n in lst:
                if n.get('id') == npc_id:
                    npc = n
                    break
            if npc:
                break
        if not npc:
            return jsonify({'error': 'NPC not found'}), 404

        if 'soloEvents' not in npc:
            npc['soloEvents'] = []
        npc['soloEvents'].insert(0, event)

        if event.get('year'):
            year_key = str(event['year'])
            chronicle = binder.setdefault('chronicle', {})
            year_list = chronicle.setdefault(year_key, [])
            npc_name = npc.get('name', 'Unknown')
            year_list.append({
                'id':  'ev-' + str(uuid.uuid4()),
                'text': f'{npc_name} — {title}',
                'cat':  'personal',
                'ts':   int(time.time() * 1000),
                'sourceEventId': event['id'],
                'auto': True,
            })

        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Added life event to %s: %s', npc_id, title)
    return jsonify({'ok': True, 'event': event}), 201


@app.route('/api/mcp/npc/<npc_id>/events/<event_id>', methods=['PATCH'])
def api_mcp_update_event(npc_id, event_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    updatable = ('year', 'season', 'title', 'mechDesc', 'flavorText', 'userNotes')

    with _save_lock:
        binder = _read_json(save_path, default={})
        npc = None
        for lst in [binder.get('living', []), binder.get('dead', [])]:
            for n in lst:
                if n.get('id') == npc_id:
                    npc = n
                    break
            if npc:
                break
        if not npc:
            return jsonify({'error': 'NPC not found'}), 404

        ev = None
        for e in npc.get('soloEvents', []):
            if e.get('id') == event_id:
                ev = e
                break
        if not ev:
            return jsonify({'error': 'Event not found'}), 404

        changed = []
        for key in updatable:
            if key in data:
                ev[key] = data[key]
                changed.append(key)

        if not changed:
            return jsonify({'error': 'No updatable fields provided'}), 400

        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Updated event %s on %s: %s', event_id, npc_id, ', '.join(changed))
    return jsonify({'ok': True, 'event': ev, 'changed': changed})


@app.route('/api/mcp/npc/<npc_id>/events/<event_id>', methods=['DELETE'])
def api_mcp_delete_event(npc_id, event_id):
    err = _auth_gm_or_mcp()
    if err: return err

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        npc = None
        for lst in [binder.get('living', []), binder.get('dead', [])]:
            for n in lst:
                if n.get('id') == npc_id:
                    npc = n
                    break
            if npc:
                break
        if not npc:
            return jsonify({'error': 'NPC not found'}), 404

        events = npc.get('soloEvents', [])
        before = len(events)
        npc['soloEvents'] = [e for e in events if e.get('id') != event_id]
        if len(npc['soloEvents']) == before:
            return jsonify({'error': 'Event not found'}), 404

        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Deleted event %s from %s', event_id, npc_id)
    return jsonify({'ok': True, 'deleted': event_id})


@app.route('/api/mcp/chronicle/<year>', methods=['POST'])
def api_mcp_add_chronicle(year):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    text = data.get('text', '')
    if not isinstance(text, str) or not text.strip():
        return jsonify({'error': 'text is required'}), 400

    try:
        year_int = int(year)
    except (ValueError, TypeError):
        return jsonify({'error': 'year must be a number'}), 400

    cat = str(data.get('cat', 'political'))[:40]
    entry_id = 'ev-' + str(uuid.uuid4())

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    entry = {
        'id':   entry_id,
        'text': text.strip()[:4000],
        'cat':  cat,
        'ts':   int(datetime.now(timezone.utc).timestamp() * 1000),
    }

    with _save_lock:
        binder = _read_json(save_path, default={})
        chronicle = binder.setdefault('chronicle', {})
        year_key = str(year_int)
        chronicle.setdefault(year_key, []).append(entry)
        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Added chronicle entry for year %s: %s', year_int, entry_id)
    return jsonify({'ok': True, 'id': entry_id, 'entry': entry}), 201


@app.route('/api/mcp/chronicle/<year>/<entry_id>', methods=['PATCH'])
def api_mcp_update_chronicle(year, entry_id):
    err = _auth_gm_or_mcp()
    if err: return err
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    try:
        year_int = int(year)
    except (ValueError, TypeError):
        return jsonify({'error': 'year must be a number'}), 400

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        chronicle = binder.get('chronicle', {})
        entries = chronicle.get(str(year_int), [])

        entry = next((e for e in entries if e.get('id') == entry_id), None)
        if not entry:
            return jsonify({'error': 'Chronicle entry not found'}), 404

        changed = []
        if 'text' in data:
            entry['text'] = str(data['text'])[:4000]
            changed.append('text')
        if 'cat' in data:
            entry['cat'] = str(data['cat'])[:40]
            changed.append('cat')

        if not changed:
            return jsonify({'error': 'No updatable fields provided (text, cat)'}), 400

        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Updated chronicle entry %s (year %s): %s', entry_id, year_int, ', '.join(changed))
    return jsonify({'ok': True, 'id': entry_id, 'changed': changed, 'entry': entry})


@app.route('/api/mcp/chronicle/<year>/<entry_id>', methods=['DELETE'])
def api_mcp_delete_chronicle(year, entry_id):
    err = _auth_gm_or_mcp()
    if err: return err

    try:
        year_int = int(year)
    except (ValueError, TypeError):
        return jsonify({'error': 'year must be a number'}), 400

    save_path = get_save_path()
    if not save_path or not save_path.exists():
        return jsonify({'error': 'Save file not found'}), 503

    with _save_lock:
        binder = _read_json(save_path, default={})
        chronicle = binder.get('chronicle', {})
        year_key = str(year_int)
        entries = chronicle.get(year_key, [])

        original_len = len(entries)
        entries = [e for e in entries if e.get('id') != entry_id]
        if len(entries) == original_len:
            return jsonify({'error': 'Chronicle entry not found'}), 404

        chronicle[year_key] = entries
        _rotate_backup(save_path)
        _write_json(save_path, binder)

    log.info('[MCP] Deleted chronicle entry %s from year %s', entry_id, year_int)
    return jsonify({'ok': True, 'deleted': entry_id})


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
        log.info('[Setup] users.json created — visit /setup to set passwords.')

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
