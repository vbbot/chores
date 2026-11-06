#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="${E2E_FIREBASE_PROJECT_ID:?E2E_FIREBASE_PROJECT_ID is required}"
PORT="${E2E_PORT:-3001}"
LOG_FILE="$(mktemp -t chores-e2e-next.XXXXXX.log)"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    pkill -P "$APP_PID" 2>/dev/null || true
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE"
}
trap cleanup EXIT INT TERM

export E2E_EMULATOR="true"
export E2E_FIREBASE_PROJECT_ID="$PROJECT"
export NEXT_TELEMETRY_DISABLED="1"
export FIREBASE_PROJECT_ID="$PROJECT"
export FIREBASE_WEB_API_KEY="demo-key"
export FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}"
export FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}"
export ALTCHA_HMAC_KEY="e2e-altcha-hmac-key"
export ALTCHA_COST="5000"
export CRON_SECRET="e2e-cron-secret"
export SESSION_COOKIE_SECURE="false"
export NEXT_PUBLIC_API_URL=""
export NEXT_PUBLIC_FIREBASE_API_KEY="demo-key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${PROJECT}.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="$PROJECT"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="000000000000"
export NEXT_PUBLIC_FIREBASE_APP_ID="1:000000000000:web:e2e"
export NEXT_PUBLIC_FIREBASE_VAPID_KEY=""
export BASE_URL="http://127.0.0.1:${PORT}"

cd apps/web
npm run build >"$LOG_FILE" 2>&1
npx next start -p "$PORT" >>"$LOG_FILE" 2>&1 &
APP_PID=$!

ready=false
for _ in $(seq 1 120); do
  if curl -fsS "${BASE_URL}/login" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "Next server exited before becoming ready." >&2
    tail -60 "$LOG_FILE" >&2
    exit 1
  fi
  sleep 1
done

if [ "$ready" != "true" ]; then
  echo "Next server did not become ready at ${BASE_URL}." >&2
  tail -60 "$LOG_FILE" >&2
  exit 1
fi

npx playwright test
