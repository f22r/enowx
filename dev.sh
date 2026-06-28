#!/usr/bin/env bash
# Dev mode, hot-reload, no build step:
#   - backend: air rebuilds Go on change (-tags dev, no SPA embed), port 8787
#   - frontend: vite dev server on 5173, proxies /api + /v1 → 8787
# Open http://localhost:5173
set -euo pipefail
cd "$(dirname "$0")"

command -v air >/dev/null 2>&1 || { echo "installing air…"; go install github.com/air-verse/air@latest; }

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▶ backend (air, :8787) + frontend (vite, :5173)"
( air ) &
( cd web && npm run dev ) &
wait
