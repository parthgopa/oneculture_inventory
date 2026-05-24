#!/bin/bash
# ============================================================
# DEPLOY SCRIPT - Runs on server on every push to main
# Triggered by GitHub Actions
# ============================================================

set -e

REPO_DIR="/var/www/oneculture/repo"
FRONTEND_DIST="/var/www/oneculture/frontend"

echo "========================================"
echo " OneCulture Inventory - Deploying..."
echo "========================================"

cd $REPO_DIR

# --- Pull latest code ---
echo "[1/4] Pulling latest code from main..."
git pull origin main

# --- Backend: install any new dependencies & restart ---
echo "[2/4] Updating backend dependencies..."
cd $REPO_DIR/backend
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate

echo "      Restarting backend service..."
systemctl restart oneculture-backend
systemctl is-active --quiet oneculture-backend && echo "      Backend: OK" || echo "      Backend: FAILED"

# --- Frontend: rebuild and copy to web root ---
echo "[3/4] Rebuilding frontend..."
cd $REPO_DIR/frontend
npm ci --quiet
npm run build

echo "      Copying build to web root..."
rm -rf $FRONTEND_DIST/*
cp -r dist/* $FRONTEND_DIST/

# --- Reload Nginx ---
echo "[4/4] Reloading Nginx..."
nginx -t && systemctl reload nginx

echo "========================================"
echo " Deploy complete!"
echo "========================================"
