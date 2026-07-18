#!/bin/bash
# ============================================================
# ONE-TIME SERVER SETUP SCRIPT
# Run this ONCE on your VPS: bash setup.sh
# Server: root@147.79.71.224
# ============================================================

set -e

echo "========================================"
echo " OneCulture Inventory - Server Setup"
echo "========================================"

# --- System update ---
apt update && apt upgrade -y

# --- Install core dependencies ---
apt install -y git curl wget unzip nginx certbot python3-certbot-nginx

# --- Install Node.js 20 (for frontend build) ---
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# --- Install Python 3, pip, venv ---
apt install -y python3 python3-pip python3-venv

# --- Create app directories ---
mkdir -p /var/www/oneculture/frontend
mkdir -p /var/www/oneculture/backend

echo "--- Cloning repository ---"
# Clone using HTTPS (GitHub Actions deploy key will handle auth later)
git clone https://github.com/parthgopa/oneculture_inventory.git /var/www/oneculture/repo

# --- Setup Python virtual environment for backend ---
echo "--- Setting up Python venv ---"
cd /var/www/oneculture/repo/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# --- Build frontend ---
echo "--- Building frontend ---"
cd /var/www/oneculture/repo/frontend
npm ci
npm run build
cp -r dist/* /var/www/oneculture/frontend/

# --- Setup Nginx configs ---
echo "--- Configuring Nginx ---"
cp /var/www/oneculture/repo/nginx/inventory.oneculture.in.conf /etc/nginx/sites-available/inventory.oneculture.in
cp /var/www/oneculture/repo/nginx/backend-inventory.oneculture.in.conf /etc/nginx/sites-available/backend-inventory.oneculture.in

ln -sf /etc/nginx/sites-available/inventory.oneculture.in /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/backend-inventory.oneculture.in /etc/nginx/sites-enabled/

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# --- Setup Gunicorn as systemd service ---
echo "--- Setting up Gunicorn systemd service ---"
cp /var/www/oneculture/repo/oneculture-backend.service /etc/systemd/system/oneculture-backend.service
systemctl daemon-reload
systemctl enable oneculture-backend
systemctl start oneculture-backend

echo "========================================"
echo " Setup complete!"
echo " Now run: scp backend/.env root@147.79.71.224:/var/www/oneculture/repo/backend/.env"
echo " Then: certbot --nginx -d inventory.oneculture.in -d backend-inventory.oneculture.in"
echo "========================================"
