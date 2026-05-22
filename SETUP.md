# KumoMTA Control Panel — Setup Guide

A visual management dashboard for KumoMTA: IP rotation, DKIM, domain rules, email logs, suppression list, and one-click config deploy.

---

## Requirements

- Ubuntu 22.04 or 24.04 (fresh server recommended)
- Root access
- Ports 25, 8050, 9000 open in firewall

---

## Fresh Server Install (One Command)

```bash
git clone https://github.com/smsohagbd/kumomata.git /tmp/kumomata
sudo bash /tmp/kumomata/scripts/install.sh
```

The script installs and configures everything automatically:

| What | Detail |
|------|--------|
| KumoMTA | Downloaded from official GitHub releases |
| Panel Backend | Python / FastAPI on port **8050** |
| Panel Frontend | React on port **9000** |
| Database | SQLite at `/opt/kumomta-panel/kumomta_panel.db` |
| All services | Enabled to start on reboot automatically |

When done, open: `http://YOUR_SERVER_IP:9000`

---

## After Install — First Steps

1. **IP Addresses** → Add your server's sending IPs (include hostname/PTR for EHLO)
2. **Domain Rules** → Set Gmail / Yahoo / Outlook sending limits
3. **DKIM Keys** → Generate a key for each sending domain → add DNS TXT record
4. **Config & Deploy** → Click **Deploy Config** (writes `init.lua` + restarts KumoMTA)
5. **Test** → Use Config & Deploy → **Test SMTP** to verify port 25 is working

---

## Updating (Pull Latest Code)

After the first install, one command updates everything:

```bash
kumomta-update
```

This pulls the latest code from GitHub, rebuilds the frontend, restarts all services.

---

## After a Reboot

All services are enabled to auto-start. If anything stopped:

```bash
kumomta-start
```

Or manually:

```bash
systemctl start kumomta kumomta-panel-backend kumomta-panel-frontend
```

---

## Ports

| Port | Service |
|------|---------|
| 25 | KumoMTA SMTP (inbound relay) |
| 8001 | KumoMTA HTTP API (localhost only) |
| 8050 | Panel Backend API |
| 9000 | Panel Frontend (dashboard) |

---

## Switching Database (Optional)

Default is SQLite. To switch to MySQL:

```bash
# Install driver
/opt/kumomta-panel/backend/venv/bin/pip install pymysql

# Edit service
systemctl edit kumomta-panel-backend
```

Add under `[Service]`:
```ini
Environment=DATABASE_URL=mysql+pymysql://user:password@localhost:3306/kumomta_panel
```

Then restart:
```bash
systemctl restart kumomta-panel-backend
```

PostgreSQL:
```bash
/opt/kumomta-panel/backend/venv/bin/pip install psycopg2-binary
# DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/kumomta_panel
```

---

## Useful Commands

```bash
# Service status
systemctl status kumomta
systemctl status kumomta-panel-backend
systemctl status kumomta-panel-frontend

# Live logs
journalctl -u kumomta -f
journalctl -u kumomta-panel-backend -f

# Restart everything
systemctl restart kumomta kumomta-panel-backend kumomta-panel-frontend

# Update panel to latest version
kumomta-update
```

---

## File Locations

| File | Path |
|------|------|
| KumoMTA config | `/opt/kumomta/etc/policy/init.lua` |
| Shaping rules | `/opt/kumomta/etc/policy/shaping.toml` |
| DKIM keys | `/var/lib/kumomta/data/dkim/<domain>/kumomta.key` |
| Email logs | `/var/log/kumomta/` (zstd compressed) |
| Panel database | `/opt/kumomta-panel/kumomta_panel.db` |
| Panel backend | `/opt/kumomta-panel/backend/` |
| Panel frontend | `/opt/kumomta-panel/frontend/` |
| Update script | `/opt/kumomta-panel/scripts/update.sh` |

---

## Troubleshooting

### KumoMTA won't start
```bash
journalctl -u kumomta --no-pager | tail -20
```
Common causes:
- Missing spool dirs → `mkdir -p /var/spool/kumomta/data /var/spool/kumomta/meta && chown -R kumod:kumod /var/spool/kumomta`
- Bad Lua syntax → redeploy config from dashboard

### Panel shows "KumoMTA Offline"
```bash
curl -s http://127.0.0.1:8001/metrics | head -3
```
If no response → KumoMTA is not running. Start it: `systemctl start kumomta`

### Email logs not showing
1. Deploy config from dashboard (enables 10-second log segments)
2. Check log dir: `ls -la /var/log/kumomta/`
3. Fix ownership: `chown -R kumod:kumod /var/log/kumomta`

### Config deploy fails (no write permission)
The backend must run as root (set in systemd service). Check:
```bash
systemctl cat kumomta-panel-backend | grep User
```
Should show `User=root`.

### Port 25 connection refused
```bash
systemctl start kumomta
ss -tlnp | grep :25
```
