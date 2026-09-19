#!/usr/bin/env bash
# Render build for the admin Next.js app (pnpm monorepo).
set -euo pipefail

echo "[render-build-admin] node=$(node -v) cwd=$(pwd)"

if [[ -z "${NEXT_PUBLIC_API_URL:-}" ]]; then
  echo "[render-build-admin] ERROR: NEXT_PUBLIC_API_URL must be set in Render env before build." >&2
  echo "  Example: https://your-api.onrender.com/api" >&2
  echo "  (.env.local is NOT used on Render; NEXT_PUBLIC_* is inlined at build time.)" >&2
  exit 1
fi

echo "[render-build-admin] NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"

PNPM=(pnpm)
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
  corepack prepare pnpm@9.15.0 --activate || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  PNPM=(npx --yes pnpm@9.15.0)
fi

"${PNPM[@]}" install --frozen-lockfile --prod=false
"${PNPM[@]}" --filter @lumea/types build
"${PNPM[@]}" --filter @lumea/utils build
"${PNPM[@]}" --filter @lumea/validation build
"${PNPM[@]}" --filter @lumea/ui build
"${PNPM[@]}" --filter @lumea/admin build

test -d apps/admin/.next
echo "[render-build-admin] OK"
