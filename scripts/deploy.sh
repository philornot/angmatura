#!/usr/bin/env bash
# Pulls latest code, rebuilds, and restarts the PM2 process.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull

if command -v bun >/dev/null 2>&1 && bun --version >/dev/null 2>&1; then
	PKG_RUNNER="bun"
else
	PKG_RUNNER="npm"
fi

echo "==> Installing dependencies (using $PKG_RUNNER)"
if [ "$PKG_RUNNER" = "bun" ]; then
	bun install
else
	npm install
fi

echo "==> Building (using $PKG_RUNNER)"
if [ "$PKG_RUNNER" = "bun" ]; then
	bun run build
else
	npm run build
fi

echo "==> Restarting PM2 process"
pm2 restart ecosystem.config.cjs --update-env

echo "==> Deployed."
pm2 status