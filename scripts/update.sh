#!/bin/bash
# ============================================================
# KumoMTA Control Panel — Update Script
# Run this any time you want to pull the latest code.
#
# Usage (from anywhere on the server):
#   bash /opt/kumomta-panel/update.sh
# ============================================================
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}  $1"; }
info() { echo -e "${BLUE}[..]${NC}  $1"; }
err()  { echo -e "${RED}[!!]${NC}  $1"; exit 1; }

PANEL_DIR="/opt/kumomta-panel"
REPO_URL="https://github.com/smsohagbd/kumomata.git"
TMP_DIR="/opt/kumomata-update-tmp"

[ "$EUID" -ne 0 ] && err "Run as root: sudo bash $0"

echo ""
echo "======================================================"
echo "  KumoMTA Panel — Update"
echo "======================================================"
echo ""

# ── Pull latest code ─────────────────────────────────────
info "Downloading latest code..."
rm -rf "$TMP_DIR"
git clone --depth=1 "$REPO_URL" "$TMP_DIR" || err "Git clone failed"
ok "Latest code downloaded"

# ── Update backend ────────────────────────────────────────
info "Updating backend..."
cp -r "$TMP_DIR/backend/"*.py "$PANEL_DIR/backend/"
cp -r "$TMP_DIR/backend/routers/"*.py "$PANEL_DIR/backend/routers/"
cp -r "$TMP_DIR/backend/services/"*.py "$PANEL_DIR/backend/services/"
cp "$TMP_DIR/backend/requirements.txt" "$PANEL_DIR/backend/requirements.txt"

# Install any new Python dependencies
"$PANEL_DIR/backend/venv/bin/pip" install -q -r "$PANEL_DIR/backend/requirements.txt"
ok "Backend updated"

# ── Restart backend ───────────────────────────────────────
info "Restarting backend..."
systemctl restart kumomta-panel-backend
sleep 2
systemctl is-active --quiet kumomta-panel-backend && ok "Backend running" || err "Backend failed — check: journalctl -u kumomta-panel-backend"

# ── Update and rebuild frontend ───────────────────────────
info "Updating frontend..."
cp -r "$TMP_DIR/frontend/src" "$PANEL_DIR/frontend/"
cp "$TMP_DIR/frontend/package.json" "$PANEL_DIR/frontend/"
cp "$TMP_DIR/frontend/vite.config.ts" "$PANEL_DIR/frontend/" 2>/dev/null || true
cp "$TMP_DIR/frontend/tsconfig"*.json "$PANEL_DIR/frontend/" 2>/dev/null || true

info "Installing frontend dependencies..."
cd "$PANEL_DIR/frontend"
npm install -q

info "Building frontend..."
npm run build -q
ok "Frontend built"

# ── Restart frontend ──────────────────────────────────────
info "Restarting frontend..."
systemctl restart kumomta-panel-frontend
sleep 2
systemctl is-active --quiet kumomta-panel-frontend && ok "Frontend running" || err "Frontend failed — check: journalctl -u kumomta-panel-frontend"

# ── Ensure all services start on boot ────────────────────
systemctl enable kumomta kumomta-panel-backend kumomta-panel-frontend 2>/dev/null || true

# ── Cleanup ───────────────────────────────────────────────
rm -rf "$TMP_DIR"

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "======================================================"
echo -e "${GREEN}  Update Complete!${NC}"
echo "======================================================"
echo ""
echo -e "  Dashboard : ${BLUE}http://$SERVER_IP:9000${NC}"
echo ""
