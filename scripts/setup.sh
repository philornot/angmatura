#!/usr/bin/env bash
# First-time setup on the Raspberry Pi. Run once after cloning the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> angmatura setup"

# Pick a package manager: prefer Bun, but fall back to npm if Bun isn't
# available or doesn't actually run on this machine (e.g. some Raspberry Pi
# / 32-bit userland setups where the official Bun binary fails with
# "cannot execute: required file not found").
PKG_RUNNER="bun"

if ! command -v bun >/dev/null 2>&1; then
	echo "==> Installing Bun"
	curl -fsSL https://bun.sh/install | bash || true
	# shellcheck disable=SC1090
	source "$HOME/.bashrc" 2>/dev/null || true
fi

if command -v bun >/dev/null 2>&1 && bun --version >/dev/null 2>&1; then
	PKG_RUNNER="bun"
else
	echo "!! Bun is not available or won't run on this system, falling back to npm."
	PKG_RUNNER="npm"
fi

# If we're falling back to npm, make sure npm (and Node.js) actually exists.
# Raspberry Pi OS often has neither pre-installed.
if [ "$PKG_RUNNER" = "npm" ] && ! command -v npm >/dev/null 2>&1; then
	echo "==> npm not found, installing Node.js + npm via apt"
	sudo apt-get update || echo "!! apt-get update had errors (maybe a broken third-party repo) — continuing anyway"
	sudo apt-get install -y nodejs npm
	if ! command -v npm >/dev/null 2>&1; then
		echo "!! Still no npm after apt install. Install Node.js manually, then re-run this script:"
		echo "   https://github.com/nodesource/distributions"
		exit 1
	fi
fi

echo "==> Installing dependencies (using $PKG_RUNNER)"
if [ "$PKG_RUNNER" = "bun" ]; then
	bun install
else
	npm install
fi

echo "==> Running tests (using $PKG_RUNNER)"
if [ "$PKG_RUNNER" = "bun" ]; then
	bun run test
else
	npm test
fi

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

echo "==> Building (using $PKG_RUNNER)"
if [ "$PKG_RUNNER" = "bun" ]; then
	bun run build
else
	npm run build
fi

echo "==> Starting with PM2"
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Done. Configure the Cloudflare Tunnel per deploy.config.yaml, then run:"
echo "    cloudflared tunnel route dns \$(yq '.tunnel_name' deploy.config.yaml) \$(yq '.tunnel_hostname' deploy.config.yaml)"
echo "    cloudflared service install"