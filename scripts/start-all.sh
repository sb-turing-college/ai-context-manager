#!/usr/bin/env bash
# Capstone-style stack launcher (Unix):
#   1) Backend  — http://127.0.0.1:8000
#   2) Frontend — http://127.0.0.1:5173
#
# Usage (from monorepo root):
#   ./scripts/start-all.sh
#   ./scripts/start-all.sh --no-browser

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND="$MONOREPO_ROOT/backend"
UI="$MONOREPO_ROOT/ui"

BACKEND_PORT=8000
FRONTEND_PORT=5173
NO_BROWSER=false

for arg in "$@"; do
  case "$arg" in
    --no-browser) NO_BROWSER=true ;;
  esac
done

stop_port() {
  local port=$1
  local pids
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)"
  else
    pids=""
  fi
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    echo "  Port $port occupied by PID $pid -> stopping"
    kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
  done <<< "$pids"
}

wait_for_health() {
  local url=$1 label=$2 timeout=${3:-60}
  echo -n "  Waiting for $label ($url) ..."
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      echo " OK"
      return 0
    fi
    sleep 0.5
  done
  echo " TIMEOUT"
  return 1
}

wait_for_port() {
  local port=$1 label=$2 timeout=${3:-60}
  echo -n "  Waiting for $label (port $port) ..."
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo " OK"
      return 0
    fi
    if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then
      echo " OK"
      return 0
    fi
    sleep 0.5
  done
  echo " TIMEOUT"
  return 1
}

echo "=== AI Context Manager stack launcher ==="

command -v uv >/dev/null || { echo "ERROR: uv not found — https://docs.astral.sh/uv/"; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm not found"; exit 1; }
[[ -d "$BACKEND" ]] || { echo "ERROR: backend/ missing"; exit 1; }
[[ -d "$UI" ]] || { echo "ERROR: ui/ missing"; exit 1; }

[[ -f "$BACKEND/.env" ]] || { echo "ERROR: backend/.env missing — copy backend/.env.example and set API keys"; exit 1; }

echo
echo "[1/4] Freeing ports ($BACKEND_PORT, $FRONTEND_PORT)..."
stop_port "$BACKEND_PORT"
stop_port "$FRONTEND_PORT"
sleep 2

echo
echo "[2/4] Starting backend on port $BACKEND_PORT..."
(cd "$BACKEND" && uv run uvicorn src.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT") &
BACKEND_PID=$!

echo
echo "[3/4] Starting frontend on port $FRONTEND_PORT..."
if [[ ! -d "$UI/node_modules" ]]; then
  echo "  First run: installing frontend deps (npm install)..."
  (cd "$UI" && npm install)
fi
(cd "$UI" && npm run dev -- --port "$FRONTEND_PORT" --host 127.0.0.1) &
FRONTEND_PID=$!

echo
echo "[4/4] Waiting for services..."
wait_for_health "http://127.0.0.1:$BACKEND_PORT/api/v1/health" "backend" || true
wait_for_port "$FRONTEND_PORT" "frontend" || true

if [[ "$NO_BROWSER" != "true" ]]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "http://127.0.0.1:$FRONTEND_PORT" || true
  fi
fi

echo
echo "Done."
echo "  Backend:  http://127.0.0.1:$BACKEND_PORT/docs"
echo "  Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "Ctrl+C stops both (PIDs $BACKEND_PID $FRONTEND_PID)."
wait
