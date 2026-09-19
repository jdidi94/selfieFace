#!/usr/bin/env bash
set -euo pipefail
PNPM=(pnpm)
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable || true
    corepack prepare pnpm@9.15.0 --activate || true
  fi
fi
if ! command -v pnpm >/dev/null 2>&1; then
  PNPM=(npx --yes pnpm@9.15.0)
fi
cd apps/admin
exec "${PNPM[@]}" start
