#!/bin/bash
# ============================================================
# KumoMTA Control Panel — Full Server Setup
# Tested on: Ubuntu 22.04 / 24.04
#
# Ports used:
#   8001  — KumoMTA internal HTTP API  (127.0.0.1 only)
#   8050  — Panel backend  (FastAPI, 0.0.0.0)
#   9000  — Panel frontend (React static, 0.0.0.0)
#   25    — SMTP (KumoMTA)
#
# Run as root:  sudo bash scripts/install.sh
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$EUID" -ne 0 ] && error "Run as root: sudo bash scripts/install.sh"

# ── Paths & ports ───────────────────────────────────────────
PANEL_DIR="/opt/kumomta-panel"
POLICY_DIR="/opt/kumomta/etc/policy"
DKIM_DIR="/var/lib/kumomta/data/dkim"
BACKEND_PORT=8050
FRONTEND_PORT=9000
KUMOMTA_API_PORT=8001
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "======================================================"
echo "  KumoMTA Control Panel — Installation"
echo "  Server IP  : $SERVER_IP"
echo "  Backend    : http://$SERVER_IP:$BACKEND_PORT"
echo "  Frontend   : http://$SERVER_IP:$FRONTEND_PORT"
echo "======================================================"
echo ""

# ── STEP 1: System packages ─────────────────────────────────
info "Installing system packages..."
apt-get update -y -q
apt-get install -y -q curl git python3 python3-pip python3-venv ca-certificates gnupg
success "Base packages ready"

# Install Node.js 20 LTS from NodeSource (Ubuntu's default is v12 — too old)
NODE_MAJOR=20
if node --version 2>/dev/null | grep -qE '^v(20|22|24)'; then
    warn "Node.js $(node --version) already installed — skipping"
else
    info "Installing Node.js ${NODE_MAJOR} LTS (Ubuntu ships v12 which is too old)..."
    # Remove old conflicting packages before upgrading
    apt-get remove -y libnode-dev libnode72 nodejs npm 2>/dev/null || true
    apt-get autoremove -y -q 2>/dev/null || true
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
    success "Node.js $(node --version) installed"
fi

# ── STEP 2: Install KumoMTA ─────────────────────────────────
if command -v kumod &>/dev/null; then
    warn "KumoMTA already installed — skipping"
else
    # Detect Ubuntu version (e.g. "22.04")
    UBUNTU_VER=$(lsb_release -rs 2>/dev/null || echo "22.04")
    ARCH=$(dpkg --print-architecture)  # amd64 or arm64

    info "Detected Ubuntu ${UBUNTU_VER} (${ARCH})"
    info "Fetching latest KumoMTA release info from GitHub..."

    # Use GitHub API to get the latest release tag and find the right .deb URL
    RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/KumoCorp/kumomta/releases/latest")
    RELEASE_TAG=$(echo "$RELEASE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])")

    info "Latest KumoMTA release: $RELEASE_TAG"

    # Find the .deb URL matching our Ubuntu version and arch
    DEB_URL=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ubuntu_ver = '${UBUNTU_VER}'
arch = '${ARCH}'
for a in data['assets']:
    url = a['browser_download_url']
    if f'Ubuntu{ubuntu_ver}' in url and url.endswith(f'_{arch}.deb'):
        print(url)
        break
")

    if [ -z "$DEB_URL" ]; then
        # Fallback: try Ubuntu 22.04 amd64 explicitly
        DEB_URL=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data['assets']:
    url = a['browser_download_url']
    if 'Ubuntu22.04' in url and url.endswith('_amd64.deb'):
        print(url)
        break
")
    fi

    [ -z "$DEB_URL" ] && error "Could not find a .deb for Ubuntu ${UBUNTU_VER} ${ARCH}. Check https://github.com/KumoCorp/kumomta/releases"

    DEB_FILE="/tmp/kumomta_latest.deb"
    info "Downloading: $DEB_URL"
    curl -fsSL -o "$DEB_FILE" "$DEB_URL" || error "Failed to download KumoMTA .deb"

    info "Installing KumoMTA..."
    apt-get install -y "$DEB_FILE"
    rm -f "$DEB_FILE"
    success "KumoMTA installed (release: $RELEASE_TAG)"
fi

# ── STEP 3: Create directories ──────────────────────────────
info "Creating required directories..."
mkdir -p "$POLICY_DIR" "$DKIM_DIR" /var/log/kumomta /var/spool/kumomta
chown -R kumod:kumod /var/lib/kumomta /var/log/kumomta 2>/dev/null || true
success "Directories ready"

# ── STEP 4: Base KumoMTA config ─────────────────────────────
info "Writing base KumoMTA config..."

cat > "$POLICY_DIR/init.lua" << LUAEOF
-- KumoMTA base config — managed by KumoMTA Control Panel
-- Overwritten when you click "Deploy Config" in the dashboard.
local kumo = require "kumo"

kumo.on('init', function()
  -- Accept SMTP relay from localhost only
  kumo.start_esmtp_listener {
    listen = '0.0.0.0:25',
    relay_hosts = { '127.0.0.1', '::1' },
  }

  -- Internal HTTP API (localhost only, port $KUMOMTA_API_PORT)
  kumo.start_http_listener {
    listen = '127.0.0.1:$KUMOMTA_API_PORT',
  }
end)

kumo.on('get_queue_config', function(domain, tenant, campaign, routing_domain)
  return kumo.make_queue_config {}
end)

kumo.on('get_egress_source', function(source_name)
  return kumo.make_egress_source { name = source_name }
end)

kumo.on('get_egress_pool', function(pool_name)
  return kumo.make_egress_pool {
    name = pool_name,
    entries = { { name = pool_name } },
  }
end)
LUAEOF

cat > "$POLICY_DIR/shaping.toml" << 'TOMLEOF'
# KumoMTA traffic shaping — managed by KumoMTA Control Panel
# Overwritten when you click "Deploy Config" in the dashboard.

["gmail.com"]
connection_limit = 20
max_message_rate = "20/min"

["yahoo.com"]
connection_limit = 10
max_message_rate = "10/min"

["outlook.com"]
connection_limit = 15
max_message_rate = "15/min"
TOMLEOF

chown -R kumod:kumod "$POLICY_DIR" 2>/dev/null || true
success "KumoMTA config written to $POLICY_DIR"

# ── STEP 5: Start KumoMTA ───────────────────────────────────
info "Starting KumoMTA service..."
systemctl enable kumomta
systemctl start kumomta || warn "KumoMTA failed to start — run: journalctl -u kumomta"
systemctl is-active --quiet kumomta && success "KumoMTA running" || warn "KumoMTA not running yet"

# ── STEP 6: Copy project files ──────────────────────────────
info "Installing panel to $PANEL_DIR..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
mkdir -p "$PANEL_DIR"
cp -r "$PROJECT_DIR/." "$PANEL_DIR/"
cd "$PANEL_DIR"

# ── STEP 7: Python backend ──────────────────────────────────
info "Setting up Python backend..."
cd "$PANEL_DIR/backend"
python3 -m venv venv
./venv/bin/pip install -q -r requirements.txt
success "Python backend ready"

# ── STEP 8: Build React frontend ────────────────────────────
info "Building React frontend..."
cd "$PANEL_DIR/frontend"
# Patch the production API URL to this server's IP and backend port
sed -i "s|__BACKEND_URL__|http://$SERVER_IP:$BACKEND_PORT|g" .env.production
npm install -q
npm run build -q
success "Frontend built"

# ── STEP 9: Serve frontend with a static file server ────────
info "Installing 'serve' for static frontend..."
npm install -g serve -q
success "'serve' installed"

# ── STEP 10: Systemd service — backend (port 8050) ──────────
info "Creating backend systemd service (port $BACKEND_PORT)..."
cat > /etc/systemd/system/kumomta-panel-backend.service << EOF
[Unit]
Description=KumoMTA Panel Backend
After=network.target kumomta.service

[Service]
Type=simple
User=root
WorkingDirectory=$PANEL_DIR/backend
ExecStart=$PANEL_DIR/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT
Restart=always
RestartSec=5
Environment=DB_PATH=$PANEL_DIR/kumomta_panel.db
Environment=KUMOMTA_API=http://127.0.0.1:$KUMOMTA_API_PORT
Environment=KUMOMTA_POLICY_DIR=$POLICY_DIR
Environment=KUMOMTA_DKIM_DIR=$DKIM_DIR

[Install]
WantedBy=multi-user.target
EOF

# ── STEP 11: Systemd service — frontend (port 9000) ─────────
info "Creating frontend systemd service (port $FRONTEND_PORT)..."
cat > /etc/systemd/system/kumomta-panel-frontend.service << EOF
[Unit]
Description=KumoMTA Panel Frontend
After=network.target kumomta-panel-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$PANEL_DIR/frontend
ExecStart=/usr/bin/env serve -s dist -l $FRONTEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kumomta-panel-backend
systemctl enable --now kumomta-panel-frontend

systemctl is-active --quiet kumomta-panel-backend  && success "Backend  running on port $BACKEND_PORT"  || error "Backend failed — check: journalctl -u kumomta-panel-backend"
systemctl is-active --quiet kumomta-panel-frontend && success "Frontend running on port $FRONTEND_PORT" || error "Frontend failed — check: journalctl -u kumomta-panel-frontend"

# ── STEP 12: Firewall ────────────────────────────────────────
if command -v ufw &>/dev/null; then
    info "Opening firewall ports..."
    ufw allow "$BACKEND_PORT/tcp"  -y 2>/dev/null || true
    ufw allow "$FRONTEND_PORT/tcp" -y 2>/dev/null || true
    ufw allow "25/tcp"             -y 2>/dev/null || true
fi

# ── Done ────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo -e "${GREEN}  Installation Complete!${NC}"
echo "======================================================"
echo ""
echo -e "  Dashboard    : ${BLUE}http://$SERVER_IP:$FRONTEND_PORT${NC}"
echo -e "  Backend API  : ${BLUE}http://$SERVER_IP:$BACKEND_PORT${NC}"
echo ""
echo "  What to do next:"
echo "  1. Open  http://$SERVER_IP:$FRONTEND_PORT  in your browser"
echo "  2. IP Addresses   → Add your server IPs"
echo "  3. Domain Rules   → Set Gmail / Yahoo / Outlook limits"
echo "  4. DKIM Keys      → Generate a key per sending domain"
echo "  5. Config & Deploy → Click 'Deploy Config'"
echo "     (writes init.lua + shaping.toml + DKIM keys)"
echo "     (reloads KumoMTA automatically)"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status kumomta                  # KumoMTA"
echo "    sudo journalctl -u kumomta -f                  # KumoMTA logs"
echo "    sudo systemctl status kumomta-panel-backend    # Panel API"
echo "    sudo systemctl status kumomta-panel-frontend   # Panel UI"
echo ""
