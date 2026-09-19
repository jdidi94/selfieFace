#!/usr/bin/env bash
# Render / VPS build for the Nest API (pnpm monorepo — do NOT use npm).
set -euo pipefail

echo "[render-build-api] node=$(node -v) cwd=$(pwd)"

if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
  corepack prepare pnpm@9.15.0 --activate
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[render-build-api] ERROR: pnpm is required. This repo uses workspace:* (npm cannot install it)." >&2
  exit 1
fi

# Include build tooling even when the platform sets NODE_ENV=production
pnpm install --frozen-lockfile --prod=false

pnpm --filter @lumea/types build
pnpm --filter @lumea/utils build
pnpm --filter @lumea/validation build
pnpm --filter @lumea/server prisma:generate
pnpm --filter @lumea/server build

test -f apps/server/dist/main.js
echo "[render-build-api] OK — apps/server/dist/main.js ready"
