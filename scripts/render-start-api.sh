#!/usr/bin/env bash
# Start Nest API on Render (pnpm workspace).
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

exec "${PNPM[@]}" --filter @lumea/server start
