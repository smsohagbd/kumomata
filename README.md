# KumoMTA Control Panel

A visual management dashboard for [KumoMTA](https://kumomta.com) — manage IPs, domain sending rules, DKIM keys, and auto-generate configuration files without writing a single line of Lua.

## Features

- **IP Manager** — Add/remove sending IPs, assign to egress pools, enable/disable per IP
- **Domain Rules** — Set per-minute / per-hour / per-day sending limits for Gmail, Yahoo, Outlook and any custom domain
- **DKIM Keys** — Generate RSA-2048 DKIM keypairs and get ready-to-paste DNS records
- **Config Preview** — Auto-generates `init.lua` and `shaping.toml` from your settings
- **Settings** — Connect the panel to your KumoMTA instance

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Python + FastAPI |
| Database | SQLite |
| Email MTA | KumoMTA (separate install) |

## Quick Start (Development)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 9000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Production Install (Linux VPS)

```bash
chmod +x scripts/install.sh
sudo ./scripts/install.sh
```

This will:
1. Install KumoMTA via the official repository
2. Set up Python venv and install backend dependencies
3. Build the React frontend
4. Create a systemd service that starts on boot

The panel will be available at `http://YOUR_SERVER_IP:9000`

## Workflow

1. **Add your IPs** → IP Addresses page
2. **Set domain limits** → Domain Rules page (use presets for Gmail/Yahoo/Outlook)
3. **Generate DKIM keys** → DKIM Keys page → add DNS TXT records to your domain
4. **Preview config** → Config Preview page → download `init.lua` + `shaping.toml`
5. **Copy files to server** → `/opt/kumomta/etc/policy/`
6. **Reload KumoMTA** → `systemctl reload kumomta`

## Project Structure

```
kumoMta/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic validation
│   ├── database.py          # SQLite setup
│   ├── routers/             # API route handlers
│   │   ├── ips.py
│   │   ├── domains.py
│   │   ├── dkim.py
│   │   ├── config.py
│   │   ├── stats.py
│   │   └── settings.py
│   └── services/
│       ├── config_generator.py   # Lua/TOML generator
│       └── dkim_service.py       # RSA key generation
├── frontend/
│   └── src/
│       ├── pages/           # Dashboard, IPManager, DomainRules, DKIM, Config, Settings
│       ├── components/      # Sidebar, Layout, Modal, StatCard
│       └── api/client.ts    # Axios API calls
└── scripts/
    └── install.sh           # One-command VPS setup
```
