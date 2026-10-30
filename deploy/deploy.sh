#!/usr/bin/env bash
# Build locally, then push the front end and the Node server to the Azure VM.
#   HOST=azureuser@algi-demo.<region>.cloudapp.azure.com ./deploy/deploy.sh
# The VM needs Node 23.6+ (cloud-init.yaml installs Node 24) and /etc/algi/algi.env (see .env.example).
set -euo pipefail

HOST="${HOST:?set HOST=user@hostname}"
KEY="${KEY:-$HOME/.ssh/id_ed25519}"

cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci
npm test
npm run build

tar -czf /tmp/algi-dist.tgz -C dist .
tar -czf /tmp/algi-server.tgz server shared package.json package-lock.json
scp -i "$KEY" /tmp/algi-dist.tgz /tmp/algi-server.tgz deploy/nginx.conf deploy/algi-api.conf deploy/algi.service "$HOST:/tmp/"
ssh -i "$KEY" "$HOST" 'set -e
  sudo mkdir -p /var/www/algi /opt/algi /etc/algi
  sudo rm -rf /var/www/algi/*
  sudo tar -xzf /tmp/algi-dist.tgz -C /var/www/algi

  sudo rm -rf /opt/algi/server /opt/algi/shared
  sudo tar -xzf /tmp/algi-server.tgz -C /opt/algi
  sudo chown -R azureuser: /opt/algi
  (cd /opt/algi && npm ci --omit=dev)
  [ -f /etc/algi/algi.env ] || { sudo touch /etc/algi/algi.env; sudo chmod 600 /etc/algi/algi.env; }
  sudo cp /tmp/algi.service /etc/systemd/system/algi.service
  sudo systemctl daemon-reload
  sudo systemctl enable algi
  sudo systemctl restart algi

  sudo cp /tmp/algi-api.conf /etc/nginx/snippets/algi-api.conf
  # Keep certbot-managed config if HTTPS has been set up (just make sure it includes the API); otherwise install ours.
  if sudo grep -q "managed by Certbot" /etc/nginx/sites-available/algi 2>/dev/null; then
    sudo grep -q "snippets/algi-api.conf" /etc/nginx/sites-available/algi ||
      sudo sed -i "s|root /var/www/algi;|root /var/www/algi;\n    include snippets/algi-api.conf;|" /etc/nginx/sites-available/algi
  else
    sudo cp /tmp/nginx.conf /etc/nginx/sites-available/algi
    sudo ln -sf /etc/nginx/sites-available/algi /etc/nginx/sites-enabled/algi
    sudo rm -f /etc/nginx/sites-enabled/default
  fi
  sudo nginx -t && sudo systemctl reload nginx'
echo "Deployed to $HOST"
