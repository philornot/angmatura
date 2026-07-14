#!/usr/bin/env bash
# Pulls latest code, rebuilds, and restarts the PM2 process.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull

echo "==> Installing dependencies"
bun install

echo "==> Building"
bun run build

echo "==> Restarting PM2 process"
pm2 restart ecosystem.config.cjs --update-env

echo "==> Deployed."
pm2 status
