# Proxmox → Ubuntu VM Migration Plan

**Goal:** Move the Pendragon GM's Binder from Windows to an Ubuntu Server VM running under Proxmox, producing a stable, auto-starting, remotely accessible hosting environment.

---

## Phase 0 — Prerequisites & Decisions

Before touching anything, decide:

| Decision | Recommendation | Why |
|---|---|---|
| Proxmox host OS | Proxmox VE 8.x | Current LTS, best hardware support |
| VM OS | Ubuntu Server 24.04 LTS | 5-year support, minimal footprint |
| VM resources | 2 vCPU, 2 GB RAM, 20 GB disk | Flask is light; save files are KB-scale |
| Static IP | Yes (reserved in router DHCP) | So `http://binder.local` / port-forward is stable |
| Hostname | `pendragon-binder` | Readable in Proxmox and on LAN |
| External access | Cloudflare Tunnel *or* domain + Let's Encrypt | Avoids self-signed cert pain forever |
| Backups | Proxmox snapshot + nightly rsync of save file | Two-layer safety |

---

## Phase 1 — Proxmox Host Install

*(Skip if Proxmox is already installed.)*

1. Download Proxmox VE ISO from `proxmox.com/en/downloads`.
2. Flash to USB with Rufus or balenaEtcher.
3. Boot target machine from USB, run the installer.
4. During install: set root password, management IP (e.g. `192.168.1.40`), hostname `pve.local`.
5. After first boot: visit `https://192.168.1.40:8006` in a browser — accept the self-signed cert.
6. **Remove the enterprise repo warning** (it nags on every login until you do):
   ```bash
   # SSH into Proxmox as root
   nano /etc/apt/sources.list.d/pve-enterprise.list
   # Comment out the single line with a #
   # Then add the no-subscription repo:
   nano /etc/apt/sources.list.d/pve-no-subscription.list
   # Add: deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription
   apt update
   ```

---

## Phase 2 — Create Ubuntu VM

1. In Proxmox web UI → **Create VM**.
   - **Name:** `pendragon-binder`
   - **OS:** upload the Ubuntu Server 24.04 ISO first (Datacenter → local → ISO Images → Upload).
   - **System:** default (SeaBIOS, i440fx).
   - **Disks:** 20 GB, SCSI, cache = Default.
   - **CPU:** 2 cores, type `host`.
   - **Memory:** 2048 MB, no ballooning.
   - **Network:** vmbr0, VirtIO, firewall enabled.
2. Start the VM → open Console → run Ubuntu installer.
3. During install:
   - Set a static IP manually (e.g. `192.168.1.50/24`, gateway `192.168.1.1`, DNS `1.1.1.1`).
   - Username: `steve` (or whatever).
   - **Enable OpenSSH server** (checkbox on the "Featured Server Snaps" screen).
   - Skip every other snap.
4. Reboot when prompted. Log in via SSH from your workstation:
   ```bash
   ssh steve@192.168.1.50
   ```

---

## Phase 3 — Base Ubuntu Setup

```bash
# Update & upgrade
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y python3 python3-pip python3-venv git ufw fail2ban \
                    rsync curl wget htop

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 8765/tcp   # binder app (temporarily; remove once behind nginx)
sudo ufw enable
sudo ufw status

# Enable fail2ban for SSH brute-force protection
sudo systemctl enable --now fail2ban
```

---

## Phase 4 — Transfer Project Files

Two options:

### Option A — via SCP (simple, one-time)
From your Windows machine in a Git Bash or PowerShell:
```bash
# Zip first to preserve structure
cd "G:\Other computers\My Laptop"
tar -czf binder.tar.gz "Pendragon GM's Binder"
scp binder.tar.gz steve@192.168.1.50:~/

# Then on the VM:
mkdir -p ~/pendragon
tar -xzf ~/binder.tar.gz -C ~/pendragon --strip-components=1
rm ~/binder.tar.gz
```

### Option B — via Git (preferred for ongoing dev)
```bash
# On Windows: initialize the repo if not already
cd "G:\Other computers\My Laptop\Pendragon GM's Binder"
git init
git add .
git commit -m "Initial migration snapshot"
# Push to private GitHub / Gitea / self-hosted

# On VM:
cd ~
git clone <your-repo-url> pendragon
cd pendragon
```

**Files to NOT transfer (regenerate on VM instead):**
- `cert.pem`, `key.pem`, `cert.pem.bak`, `key.pem.bak` — will be regenerated or replaced with real cert
- `secrets.env` — transfer separately via scp with restrictive permissions, or recreate
- `users.json` — transfer separately (contains password hashes, still sensitive)
- `config.json` — will need the save file path updated for Linux

```bash
# Secure transfer of secrets:
scp secrets.env steve@192.168.1.50:~/pendragon/
ssh steve@192.168.1.50 "chmod 600 ~/pendragon/secrets.env"
```

---

## Phase 5 — Code Adjustments for Linux

The app is 95% portable, but a few spots assume Windows. Edit these on the VM:

### 5.1 — `config.json` save file path
The current path is `G:\Other computers\My Laptop\Pendragon GM's Binder\binder-save.json`. Change to Linux-style:
```json
{
  "saveFile": "/home/steve/pendragon/binder-save.json"
}
```

### 5.2 — `server.py` — `api_drives` (lines ~643-655)
The drive-letter enumeration is Windows-specific. Replace with Linux-friendly mount points:

```python
@app.route('/api/drives')
@gm_required
def api_drives():
    """Linux: show home + common mount locations instead of drive letters."""
    locations = []
    home = Path.home()
    if home.exists():
        locations.append({'label': '~ (home)', 'path': str(home)})
    for mnt in ['/mnt', '/media', '/']:
        p = Path(mnt)
        if p.exists():
            locations.append({'label': mnt, 'path': mnt})
    return jsonify({'base_dir': str(BASE_DIR), 'drives': locations})
```

### 5.3 — Verify path handling
Search for any hardcoded backslashes in the Python code:
```bash
grep -rn '\\\\' server.py  # should show none in logic, only regex/escape
```
`pathlib.Path` handles everything else automatically.

### 5.4 — Line endings
If transferred via zip, files should be fine. If via git without `core.autocrlf`, check:
```bash
file server.py          # should say "ASCII text" not "CRLF line terminators"
# If CRLF, convert:
sudo apt install dos2unix
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.html" -o -name "*.css" \) -exec dos2unix {} \;
```

---

## Phase 6 — Python Environment & First Run

```bash
cd ~/pendragon

# Create virtualenv
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install flask werkzeug pyopenssl

# First run — test it works
python server.py
# Visit http://192.168.1.50:8765 from your workstation
# Ctrl+C to stop
deactivate
```

---

## Phase 7 — Run as a systemd Service

This replaces the "keep a console window open" pattern with a proper auto-starting service.

Create `/etc/systemd/system/pendragon.service`:
```ini
[Unit]
Description=Pendragon GM's Binder
After=network.target

[Service]
Type=simple
User=steve
Group=steve
WorkingDirectory=/home/steve/pendragon
Environment="PATH=/home/steve/pendragon/.venv/bin"
ExecStart=/home/steve/pendragon/.venv/bin/python /home/steve/pendragon/server.py
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/pendragon.log
StandardError=append:/var/log/pendragon.log

[Install]
WantedBy=multi-user.target
```

```bash
# Create the log file with correct ownership
sudo touch /var/log/pendragon.log
sudo chown steve:steve /var/log/pendragon.log

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now pendragon
sudo systemctl status pendragon

# View logs
tail -f /var/log/pendragon.log
# Or use journalctl
journalctl -u pendragon -f
```

**Note:** the current `_console_listener` thread in `server.py` calls `input()` which will hang waiting for stdin under systemd. Either:
- **Option A:** Leave it — `input()` just silently blocks forever, no harm done. The `restart` command you used to type is replaced by `sudo systemctl restart pendragon`.
- **Option B:** Guard it behind a TTY check so it only runs interactively:
  ```python
  # In server.py, before the thread start:
  if sys.stdin.isatty():
      threading.Thread(target=_console_listener, daemon=True).start()
  ```
  (Recommended — cleaner startup under systemd.)

---

## Phase 8 — Reverse Proxy with Nginx (Real HTTPS)

Running Flask directly on port 8765 is fine for LAN-only. For the internet, put it behind nginx so you get:
- Real HTTPS via Let's Encrypt
- A proper web server in front of Flask
- Ability to move off port 8765 to 443

### 8.1 — Install nginx
```bash
sudo apt install -y nginx
sudo ufw allow 'Nginx Full'
sudo ufw delete allow 8765/tcp   # close the direct port once nginx is up
```

### 8.2 — Bind Flask to localhost only
Edit `server.py`:
```python
app.run(host='127.0.0.1', port=PORT, ssl_context=None, debug=False)
```
(Remove `0.0.0.0` so Flask is only reachable through nginx.)

Also set `FORCE_HTTP=1` in `secrets.env` so Flask doesn't try to generate certs — nginx handles HTTPS.

Restart: `sudo systemctl restart pendragon`

### 8.3 — Nginx site config
Create `/etc/nginx/sites-available/pendragon`:
```nginx
server {
    listen 80;
    server_name pendragon.yourdomain.com;

    # Redirect all HTTP to HTTPS (once certbot has run)
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name pendragon.yourdomain.com;

    # These paths will be filled in by certbot in the next step
    ssl_certificate     /etc/letsencrypt/live/pendragon.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pendragon.yourdomain.com/privkey.pem;

    # Modern TLS config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Increase body size for save file POSTs
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pendragon /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 8.4 — Let's Encrypt cert
Requires a real domain pointing to your public IP, plus port 80 open in the router.
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pendragon.yourdomain.com
# Answers: your email, agree to TOS, whether to redirect HTTP→HTTPS (yes)
# Auto-renewal is installed automatically as a systemd timer
sudo systemctl status certbot.timer
```

**Alternative — no domain needed:** use DuckDNS (free dynamic DNS). Create an account, pick a subdomain like `stevebinder.duckdns.org`, point it at your public IP, then certbot will happily issue a cert for it.

### 8.5 — (Optional) Trust `X-Forwarded-Proto` in Flask
So Flask sees requests as HTTPS when nginx forwards them:
```python
# In server.py, after app = Flask(...):
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
```

---

## Phase 9 — Alternative: Cloudflare Tunnel (zero port-forwarding)

If you don't want to mess with domains or port forwarding, use Cloudflare Tunnel:

1. Sign up at `one.dash.cloudflare.com` (free).
2. Install cloudflared:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```
3. In the Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create Tunnel**.
4. Follow the guided setup — it gives you a one-line `sudo cloudflared service install <token>` command.
5. Add a public hostname that routes to `http://localhost:8765`.
6. You now have `https://pendragon.<your-account>.cloudflareaccess.com` (or any custom domain you add) with a real trusted cert, no port forwarding, no firewall changes.

This is **drastically easier** than nginx + certbot if you don't already have a domain and nginx expertise.

---

## Phase 10 — Backups

Two layers:

### 10.1 — Proxmox VM snapshots (whole-system restore)
In Proxmox web UI: select the VM → **Backup** → **Backup now**. Set a schedule under **Datacenter → Backup** — nightly to the local-zfs storage or a separate NAS. Keep 7 daily + 4 weekly.

### 10.2 — Save file rsync (fine-grained, fast restore)
The app already keeps 5 rolling `backups/` inside its folder, but that's on the same disk. Add an off-VM nightly copy:
```bash
# On a NAS or your workstation, set up SSH key auth to the VM, then cron:
0 3 * * * rsync -avz steve@192.168.1.50:/home/steve/pendragon/binder-save.json \
  /backups/pendragon/binder-save-$(date +\%Y\%m\%d).json
```

---

## Phase 11 — Router & Network Config

If using nginx + Let's Encrypt (Phase 8), port-forward on your router:
- **External 80** → `192.168.1.50:80` (needed for Let's Encrypt HTTP-01 challenges + HTTP redirect)
- **External 443** → `192.168.1.50:443` (the actual app)

If using Cloudflare Tunnel (Phase 9), **no port forwarding needed** — the tunnel is outbound from the VM to Cloudflare.

Either way:
- Reserve the VM's static IP in router DHCP so it never changes.
- Do **not** forward port 8765 externally.

---

## Phase 12 — Cutover Checklist

Before flipping your group to the new URL:

- [ ] VM boots to login prompt after `reboot` command (tests auto-start)
- [ ] `systemctl status pendragon` shows `active (running)` after boot
- [ ] HTTPS URL loads the app from an external device (phone on cellular is a good test)
- [ ] Login works for GM + at least one player account
- [ ] Save file loads correctly, shows the right year/roster/manors
- [ ] Dashboard, Roster, Manors, Families, Winter, Mausoleum, Chronicle tabs all render
- [ ] GM broadcast + presence features work cross-device
- [ ] Trigger a save, verify the backup rotation in `backups/` works
- [ ] Trigger a Proxmox snapshot, restore it in a test clone, verify app still runs
- [ ] Email / message players the new URL
- [ ] Leave the Windows server running for 48 hours as a fallback
- [ ] Once confirmed stable, shut down the Windows server

---

## Phase 13 — Things to Reconsider Later

- **Gunicorn instead of Flask dev server.** Flask's built-in server is officially "not for production." It's been rock-solid for a handful of users, but gunicorn is the proper Linux choice:
  ```bash
  pip install gunicorn
  # Change ExecStart in systemd unit to:
  ExecStart=/home/steve/pendragon/.venv/bin/gunicorn -b 127.0.0.1:8765 -w 2 server:app
  ```
  Two workers is plenty for your use case. Gunicorn handles threading more cleanly than Flask's dev server.

- **SQLite for users.** `users.json` with a file lock works, but SQLite would give you atomic transactions for free. Not urgent.

- **Log rotation.** `/var/log/pendragon.log` will grow forever. Add logrotate config:
  ```bash
  sudo nano /etc/logrotate.d/pendragon
  ```
  ```
  /var/log/pendragon.log {
      weekly
      rotate 8
      compress
      delaycompress
      missingok
      notifempty
      copytruncate
  }
  ```

- **Monitoring.** Uptime Kuma in another Proxmox VM/container is dead simple and will ping-notify you if the binder goes down.

---

## Estimated Effort

| Phase | Hands-on time |
|---|---|
| 1 — Proxmox install | 30 min |
| 2 — Ubuntu VM create | 20 min |
| 3 — Base setup | 10 min |
| 4 — File transfer | 15 min |
| 5 — Code tweaks | 20 min |
| 6 — First run | 5 min |
| 7 — systemd service | 15 min |
| 8 — Nginx + certbot | 30 min |
| 9 — OR Cloudflare Tunnel | 15 min |
| 10 — Backups | 20 min |
| 11 — Router config | 10 min |
| 12 — Cutover testing | 30 min |

**Total: ~3 hours of focused work**, spread across whenever you have the time. None of it needs to be done in one sitting.

---

*Last updated: 2026-04-05*
