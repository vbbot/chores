#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost}"
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost:8000/health}"

echo "== ChoreSync verification loop =="

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop, then re-run." >&2
  exit 1
fi

echo "[1/4] Starting stack"
docker compose up -d --build

echo "[2/4] Waiting for backend and frontend"
for _ in $(seq 1 90); do
  if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1 && curl -fsS "$BASE_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
  echo "Backend health check failed at $API_HEALTH_URL" >&2
  docker compose logs --tail=60 backend >&2
  exit 1
fi

if ! curl -fsS "$BASE_URL" >/dev/null 2>&1; then
  echo "Frontend did not answer at $BASE_URL" >&2
  docker compose logs --tail=60 frontend nginx >&2
  exit 1
fi

echo "[3/4] Preparing Playwright"
cd "$ROOT/frontend"
if [ ! -d node_modules/@playwright/test ]; then
  npm install --no-audit --no-fund
fi
npx playwright install chromium

echo "[4/4] Running browser journey"
rm -rf artifacts/screenshots
npx playwright test "$@"

echo
echo "Screenshots: frontend/artifacts/screenshots/<project>/"
echo "Report:      frontend/artifacts/html-report/index.html"
