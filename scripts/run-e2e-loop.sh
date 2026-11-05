#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost}"
ALTCHA_URL="${ALTCHA_URL:-$BASE_URL/api/altcha/challenge}"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

echo "== Chores verification loop =="

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop, then re-run." >&2
  exit 1
fi

echo "[1/4] Starting stack"
docker compose up -d --build

echo "[2/4] Waiting for the app and ALTCHA challenge endpoint"
for _ in $(seq 1 120); do
  if curl -fsS "$BASE_URL" >/dev/null 2>&1 && curl -fsS "$ALTCHA_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -fsS "$BASE_URL" >/dev/null 2>&1; then
  echo "App did not answer at $BASE_URL" >&2
  docker compose logs --tail=80 frontend nginx >&2
  exit 1
fi

if ! curl -fsS "$ALTCHA_URL" >/dev/null 2>&1; then
  echo "ALTCHA challenge did not answer at $ALTCHA_URL" >&2
  docker compose logs --tail=80 frontend >&2
  exit 1
fi

echo "[3/4] Preparing Playwright"
cd "$ROOT/apps/web"
if [ ! -d "$ROOT/node_modules/@playwright/test" ]; then
  npm install --no-audit --no-fund
fi
npx playwright install chromium

echo "[4/4] Running browser journey"
rm -rf artifacts/screenshots
FIREBASE_SERVICE_ACCOUNT_PATH="$HOME/.config/firebase-admin.json" BASE_URL="$BASE_URL" npx playwright test "$@"

echo
echo "Screenshots: apps/web/artifacts/screenshots/<project>/"
echo "Report:      apps/web/artifacts/html-report/index.html"
