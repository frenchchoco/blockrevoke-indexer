#!/usr/bin/env bash
set -euo pipefail

echo "=== BlockRevoke Indexer — Hetzner Deploy Script ==="
echo ""

# ── 1. System packages ──
echo "[1/6] Installing system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw

# ── 2. Node.js 24 ──
echo "[2/6] Installing Node.js 24..."
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y -qq nodejs
echo "Node: $(node -v)"

# ── 3. PostgreSQL 16 ──
echo "[3/6] Installing PostgreSQL..."
apt-get install -y -qq postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Create database and user
echo "[3/6] Setting up database..."
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
sudo -u postgres psql -c "CREATE USER blockrevoke WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE blockrevoke_db OWNER blockrevoke;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE blockrevoke_db TO blockrevoke;"
echo ""
echo "Generated DB password: ${DB_PASS}"
echo "Save this password and update /opt/blockrevoke-indexer/.env"
echo ""

# ── 4. PM2 ──
echo "[4/6] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ── 5. Clone and build ──
echo "[5/6] Cloning and building..."
mkdir -p /opt
cd /opt

if [ -d "blockrevoke-indexer" ]; then
    cd blockrevoke-indexer
    git pull
else
    # Replace with your actual repo URL
    git clone https://github.com/YOUR_USER/blockrevoke-indexer.git
    cd blockrevoke-indexer
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit /opt/blockrevoke-indexer/.env with your actual values!"
    echo "   Especially DATABASE_URL password"
    echo ""
fi

npm ci
npm run build

# Create log directory
mkdir -p /var/log/blockrevoke

# ── 6. Firewall ──
echo "[6/6] Configuring firewall..."
ufw allow 22/tcp
ufw allow 3000/tcp
ufw --force enable

# ── Start with PM2 ──
echo "Starting with PM2..."
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✅ BlockRevoke Indexer deployed!"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/blockrevoke-indexer/.env (set DB password)"
echo "  2. Restart: pm2 restart all"
echo "  3. Check: pm2 status && curl localhost:3000/health"
echo ""
