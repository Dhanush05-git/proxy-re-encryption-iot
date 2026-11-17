#!/bin/bash
# start.sh — Start the PRE IoT application (backend + frontend)

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"

echo "============================================"
echo "  PRE IoT Cloud Data Sharing - Startup"
echo "============================================"

# Activate virtualenv
if [ ! -d "$VENV" ]; then
  echo "[1/3] Creating Python virtual environment..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
else
  echo "[1/3] Virtual environment found ✓"
fi

# Start backend
echo "[2/3] Starting FastAPI backend on http://localhost:8000..."
cd "$ROOT/backend"
"$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "       Backend PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 3
curl -sf http://localhost:8000/health > /dev/null && echo "       Backend healthy ✓" || echo "       Backend may still be starting..."

# Start frontend
echo "[3/3] Starting React frontend on http://localhost:5173..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  Application Running!"
echo "  Frontend: http://localhost:4321"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Demo Users (password: password123):"
echo "    alice  — IoT Data Owner"
echo "    bob    — Authorized Recipient"
echo "    charlie — Unauthorized User"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait and clean up
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Services stopped.'" SIGINT SIGTERM
wait
