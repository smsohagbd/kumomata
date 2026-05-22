#!/bin/bash
# Quick script to start all services after a reboot
# Usage: bash /opt/kumomta-panel/start.sh

systemctl start kumomta
systemctl start kumomta-panel-backend
systemctl start kumomta-panel-frontend

echo "Status:"
systemctl is-active kumomta && echo "  kumomta          : running" || echo "  kumomta          : STOPPED"
systemctl is-active kumomta-panel-backend  && echo "  panel backend    : running" || echo "  panel backend    : STOPPED"
systemctl is-active kumomta-panel-frontend && echo "  panel frontend   : running" || echo "  panel frontend   : STOPPED"
