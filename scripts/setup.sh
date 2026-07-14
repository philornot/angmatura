#!/usr/bin/env bash
# First-time setup on the Raspberry Pi. Run once after cloning the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> angmatura setup"

if ! command -v bun >/dev/null 2>&1; then
	echo "==> Installing Bun"
	curl -fsSL https://bun.sh/install | bash
	# shellcheck disable=SC1090
	source "$HOME/.bashrc"
fi

echo "==> Installing dependencies"
bun install

if [ ! -f .env ]; then
	echo "==> Creating .env from .env.example — edit it before deploying (GEMINI_API_KEY, ADMIN_PASSWORD)"
	cp .env.example .env
fi

mkdir -p data

if ! command -v pm2 >/dev/null 2>&1; then
	echo "==> Installing PM2"
	npm install -g pm2
fi

if ! command -v cloudflared >/dev/null 2>&1; then
	echo "!! cloudflared not found. Install it manually for your architecture:"
	echo "   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
fi

echo "==> Building"
bun run build

echo "==> Starting with PM2"
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Done. Configure the Cloudflare Tunnel per deploy.config.yaml, then run:"
echo "    cloudflared tunnel route dns \$(yq '.tunnel_name' deploy.config.yaml) \$(yq '.tunnel_hostname' deploy.config.yaml)"
echo "    cloudflared service install"
