#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! java -version >/dev/null 2>&1; then
  if [ -x /opt/homebrew/opt/openjdk@21/bin/java ]; then
    export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
  else
    echo "Java 21 is required for the Firestore emulator." >&2
    echo "Install it with: brew install openjdk@21" >&2
    exit 1
  fi
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI is required for the emulator harness." >&2
  echo "Install it with: npm install -g firebase-tools" >&2
  exit 1
fi

export E2E_FIREBASE_PROJECT_ID="${E2E_FIREBASE_PROJECT_ID:-demo-chores}"
export E2E_PORT="${E2E_PORT:-3001}"

exec firebase emulators:exec \
  --only auth,firestore \
  --project "$E2E_FIREBASE_PROJECT_ID" \
  "bash scripts/e2e-run.sh"
