#!/bin/bash

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.pids"

start() {
  if [ -f "$PID_FILE" ]; then
    echo "App already running. Run './app.sh stop' first."
    exit 1
  fi

  echo "Starting backend..."
  cd "$DIR/backend"
  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > "$DIR/backend.log" 2>&1 &
  BACKEND_PID=$!

  echo "Starting frontend..."
  cd "$DIR/frontend"
  npm run dev > "$DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!

  echo "Starting Cloudflare tunnel..."
  cloudflared tunnel --url http://localhost:8000 > "$DIR/tunnel.log" 2>&1 &
  TUNNEL_PID=$!

  echo "$BACKEND_PID $FRONTEND_PID $TUNNEL_PID" > "$PID_FILE"

  echo "Started. PIDs: backend=$BACKEND_PID frontend=$FRONTEND_PID tunnel=$TUNNEL_PID"
  echo "Tunnel URL will appear in tunnel.log in a few seconds:"
  sleep 3
  grep -o 'https://[^ ]*trycloudflare.com' "$DIR/tunnel.log" || echo "(check tunnel.log for URL)"
}

stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No running app found."
    exit 1
  fi

  read -r BACKEND_PID FRONTEND_PID TUNNEL_PID < "$PID_FILE"

  for PID in $BACKEND_PID $FRONTEND_PID $TUNNEL_PID; do
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" && echo "Stopped PID $PID"
    fi
  done

  rm "$PID_FILE"
  echo "App stopped."
}

case "$1" in
  start) start ;;
  stop)  stop  ;;
  *)     echo "Usage: $0 {start|stop}" ;;
esac
