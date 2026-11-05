# Chores

A UK household management PWA for chores, bin collections, shopping, bills,
calendar events, and shared notes.

## Stack

- Next.js 14 PWA
- Firebase Auth
- Firestore
- Firebase Cloud Messaging
- ALTCHA proof-of-work on login and registration
- Docker Compose and nginx

There is no separate API server, database container, Redis, or Celery worker.
Next.js route handlers use the Firebase Admin SDK.

## Repository layout

```
apps/web                 Next.js app, API routes, Playwright tests
packages/domain          Shared types, validation, and household logic
packages/api-client      Typed client with cookie and bearer auth adapters
packages/server          Firebase Admin, repositories, auth, iCal, jobs
packages/config          Shared TypeScript configuration
```

The workspace is structured so an Expo app can be added under `apps/mobile`
later. Only the PWA is built today.

## Firebase setup

1. Create a Firebase project.
2. Enable Email/Password authentication.
3. Create a Firestore database in Native mode.
4. Register a web app.
5. Generate an Admin SDK service account.
6. Generate an FCM Web Push certificate.
7. Copy `.env.example` to `.env` and fill in the values.

Store the service account outside the repo. The default local path is:

```
~/.config/firebase-admin.json
```

Docker Compose mounts that file read-only at
`/run/secrets/firebase-admin.json`. Set `SESSION_COOKIE_SECURE=true` when the
app is served over HTTPS.

Deploy Firestore rules and indexes:

```sh
firebase deploy --only firestore:rules,firestore:indexes
```

## Run with Docker

```sh
docker compose up -d --build
```

Open http://localhost.

The stack contains `frontend`, `cron`, and `nginx`. The `cron` container calls
protected internal routes at 00:05 and 19:00 Europe/London.

## Local development

```sh
npm install
set -a
source .env
set +a
FIREBASE_SERVICE_ACCOUNT_PATH="$HOME/.config/firebase-admin.json" npm run dev
```

## Verification

```sh
npm test          # shared domain tests
make e2e          # builds the stack and runs Playwright
make verify       # E2E plus domain tests
```

Playwright captures screenshots under `apps/web/artifacts/screenshots/`.

## Authentication

Login and registration are server-brokered:

1. The browser solves an ALTCHA challenge.
2. The server verifies the payload.
3. The server verifies credentials with Firebase.
4. The server sets an HTTP-only Firebase session cookie.

The API also accepts `Authorization: Bearer <Firebase ID token>` so future
mobile clients can reuse the same versioned `/api/v1` endpoints.

Firestore denies direct browser access. All reads and writes go through the
server.
