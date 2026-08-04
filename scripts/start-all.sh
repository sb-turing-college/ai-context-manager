#!/usr/bin/env bash
# Local launcher for AI Context Manager (backend + UI).
#
# Default: one terminal, multiplexed logs via pinned
# `concurrently` from `scripts/package.json` (monorepo root stays clean).
#
# Lifecycle:
#   1. Free known ports at start.
#   2. Run concurrently in the foreground (colored prefixes).
#   3. trap EXIT/INT/TERM -> port cleanup safety net after concurrently's
#      own --kill-others handling (covers uvicorn --reload / Vite children).
#
# Prefixes: api, ui
#
# Usage (from monorepo root):
#   ./scripts/start-all.sh
#   ./scripts/start-all.sh --no-browser
#   ./scripts/start-all.sh --separate-windows

set -euo pipefail

# Prefer UTF-8 for Python child processes (emoji in logs/prints on some hosts).
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND="$MONOREPO_ROOT/backend"
UI="$MONOREPO_ROOT/ui"

BACKEND_PORT=8000
FRONTEND_PORT=5173
HEALTH_URL="http://127.0.0.1:$BACKEND_PORT/api/v1/health"
FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT"
PORTS_TO_MANAGE=("$BACKEND_PORT" "$FRONTEND_PORT")

NO_BROWSER=false
SEPARATE_WINDOWS=false

for arg in "$@"; do
  case "$arg" in
    --no-browser) NO_BROWSER=true ;;
    --separate-windows) SEPARATE_WINDOWS=true ;;
    -h|--help)
      sed -n '1,25p' "$0"
      exit 0
      ;;
  esac
done

CLEANED_UP=false
cleanup() {
  if $CLEANED_UP; then
    return 0
  fi
  CLEANED_UP=true
  if $SEPARATE_WINDOWS; then
    return 0
  fi
  echo ""
  echo "Safety-net port cleanup..."
  sleep 0.5
  stop_listening_ports "${PORTS_TO_MANAGE[@]}"
  echo "Shutdown complete."
}
trap cleanup EXIT INT TERM

echo "=== AI Context Manager stack launcher ==="

command -v uv >/dev/null || { echo "ERROR: uv not found — https://docs.astral.sh/uv/"; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm not found"; exit 1; }
[[ -d "$BACKEND" ]] || { echo "ERROR: backend/ missing"; exit 1; }
[[ -d "$UI" ]] || { echo "ERROR: ui/ missing"; exit 1; }
[[ -f "$BACKEND/.env" ]] || { echo "ERROR: backend/.env missing — copy backend/.env.example and set API keys"; exit 1; }

echo ""
echo "[1] Freeing ports (${PORTS_TO_MANAGE[*]})..."
stop_listening_ports "${PORTS_TO_MANAGE[@]}"
sleep 1

ensure_frontend_npm_deps "$UI" "ui"

if $SEPARATE_WINDOWS; then
  echo ""
  echo "[2] Separate windows mode..."
  start_service_terminal "api (:$BACKEND_PORT)" \
    "cd '$BACKEND' && echo 'api' && uv run uvicorn src.main:app --reload --host 127.0.0.1 --port $BACKEND_PORT"
  start_service_terminal "ui (:$FRONTEND_PORT)" \
    "cd '$UI' && echo 'ui' && npm run dev -- --port $FRONTEND_PORT --host 127.0.0.1"
  wait_http_ok "$HEALTH_URL" "api" || true
  wait_port_listening "$FRONTEND_PORT" "ui" || true
  if ! $NO_BROWSER; then
    sleep 1
    open_url "$FRONTEND_URL"
  fi
  echo ""
  echo "Separate windows: close each terminal to stop that service."
  echo "  Frontend: $FRONTEND_URL"
  echo "  Backend:  http://127.0.0.1:$BACKEND_PORT/docs"
  SEPARATE_WINDOWS=true
  exit 0
fi

ensure_script_npm_deps "$SCRIPT_DIR"

BROWSER_PID=""
if ! $NO_BROWSER; then
  (
    sleep 5
    open_url "$FRONTEND_URL"
  ) &
  BROWSER_PID=$!
fi

echo ""
echo "[2] Starting api + ui in this terminal (concurrently)..."
echo "  Ctrl+C stops both; port cleanup runs via trap."
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  http://127.0.0.1:$BACKEND_PORT/docs"
echo ""

cd "$SCRIPT_DIR"
npm exec -- concurrently \
  -n "api,ui" \
  -c "blue,cyan" \
  --kill-others \
  "cd '$BACKEND' && uv run uvicorn src.main:app --reload --host 127.0.0.1 --port $BACKEND_PORT" \
  "cd '$UI' && npm run dev -- --port $FRONTEND_PORT --host 127.0.0.1"
status=$?

if [[ -n "$BROWSER_PID" ]]; then
  kill "$BROWSER_PID" 2>/dev/null || true
fi

exit "$status"
