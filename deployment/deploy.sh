#!/usr/bin/env bash
# HySP Certificate UI - Deployment Script (pull from ghcr.io)
# Usage: sudo bash /hysp/hycert-ui/deployment/deploy.sh

set -euo pipefail

APP_DIR="/hysp/hycert-ui"
IMAGE="ghcr.io/robert7528/hycert-ui:latest"
QUADLET_SRC="$APP_DIR/deployment/hycert-ui.container"
QUADLET_DEST="/etc/containers/systemd/hycert-ui.container"
NGINX_SRC="$APP_DIR/deployment/nginx-hycert-ui.conf"
NGINX_DEST="/etc/nginx/conf.d/service/hycert-ui.conf"

echo "=== [1/3] Pull latest source (quadlet / nginx configs) ==="
cd "$APP_DIR"
git pull

echo "=== [2/3] Pull & start container ==="
podman pull "$IMAGE"

cp "$QUADLET_SRC" "$QUADLET_DEST"
systemctl daemon-reload
systemctl restart hycert-ui
systemctl status hycert-ui --no-pager

echo "=== [3/3] Install nginx config ==="
mkdir -p "$(dirname "$NGINX_DEST")"
cp "$NGINX_SRC" "$NGINX_DEST"
nginx -t && systemctl reload nginx

echo ""
echo "Done."
echo "  UI:   https://your-domain/hycert-ui/"
echo "  Log:  journalctl -u hycert-ui -f"
