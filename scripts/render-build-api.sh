#!/usr/bin/env bash
# Render native Node build for the Nest API.
# Do NOT use `npm install` — workspace:* only works with pnpm.
set -euo pipefail

echo "[render-build-api] node=$(node -v) cwd=$(pwd)"

PNPM=(pnpm)
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
  corepack prepare pnpm@9.15.0 --activate || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[render-build-api] pnpm not on PATH — using npx pnpm@9.15.0"
  PNPM=(npx --yes pnpm@9.15.0)
fi

echo "[render-build-api] using: ${PNPM[*]}"

# Include nest/typescript/prisma even when Render sets NODE_ENV=production
"${PNPM[@]}" install --frozen-lockfile --prod=false

"${PNPM[@]}" --filter @lumea/types build
"${PNPM[@]}" --filter @lumea/utils build
"${PNPM[@]}" --filter @lumea/validation build
"${PNPM[@]}" --filter @lumea/server prisma:generate
"${PNPM[@]}" --filter @lumea/server build

test -f apps/server/dist/main.js
echo "[render-build-api] OK — apps/server/dist/main.js ready"
