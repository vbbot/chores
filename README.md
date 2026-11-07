# Chores

A UK household management PWA for chores, bin collections, shopping, bills,
calendar events, shared notes, meal planning, and a private health diary.

It includes personal and household XP, levels, on-time chore streaks, a progress
page, rule-based chore suggestions, one-off tasks, weekday and monthly recurrence,
optional due times, workload balancing, and configurable reminder schedules.

The daily brief combines chores, bins, bills, and calendar events. Each member can
override reminder times, and every item can carry its own reminder setting.

## Stack

- Next.js 14 PWA
- Firebase Auth
- Firestore
- Firebase Cloud Messaging
- ALTCHA proof-of-work on login and registration
- Docker Compose and nginx

There is no separate API server, database container, Redis, or Celery worker.
Next.js route handlers use the Firebase Admin SDK. The recipe catalogue is a
local SQLite FTS5 file mounted into the frontend container; it is not household
state and is not stored in Firestore.

## Repository layout

```
apps/web                 Next.js app, API routes, Playwright tests
packages/domain          Shared types, validation, and household logic
packages/api-client      Typed client with cookie and bearer auth adapters
packages/server          Firebase Admin, repositories, auth, iCal, jobs
packages/food-data       Recipe catalogue schema, SQLite search, importer, nutrition
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

The default compose file pulls the published image:

```sh
docker compose up -d
```

Build locally with the build override:

```sh
make up-build
```

Open http://localhost.

The stack contains `frontend`, `cron`, and `nginx`. The `cron` container creates
due chores at 00:05 and runs the reminder engine every 15 minutes, Europe/London.

## Meals and recipes

The meals section has shared ideas, a weekly plan, recipe search, nutrition
estimates, and shopping-list integration.

To build the local recipe catalogue, download the
[Food.com CC0 recipes dataset](https://www.kaggle.com/datasets/irkaal/foodcom-recipes-and-reviews)
and import it into the mounted volume:

```sh
# Local development: writes ./data/recipes.db by default.
make food-import CSV=/path/to/recipes.csv

# Docker: imports into the mounted /data volume.
docker compose -f docker-compose.yml -f docker-compose.build.yml \
  run --rm --user root -w /app -v "$PWD:/import:ro" frontend \
  npm run food:import-recipes -- /import/recipes.csv
```

For Docker, the database lives at `/data/recipes.db` and the volume is
`chores-recipe-data`. The importer is a one-off job; the image does not include
recipe data. Without the file, recipe search returns an empty catalogue and
household-imported recipes still work.

Recipe URL import only accepts `http` and `https` links with schema.org Recipe
data. It blocks private, loopback, link-local, and metadata addresses.

Health entries live under the signed-in user, not the household. They are
excluded from household export and are never returned in member or admin views.

## Local development

```sh
npm install
set -a
source .env
set +a
FIREBASE_SERVICE_ACCOUNT_PATH="$HOME/.config/firebase-admin.json" npm run dev
```

## Deployment

The production deployment is Docker Compose behind a Cloudflare Tunnel.

1. Bind nginx to localhost only. This is already set in `docker-compose.yml`.
2. Set `SESSION_COOKIE_SECURE=true` in `.env` for HTTPS deployments.
3. Add the public hostname to Firebase Authentication authorised domains.
4. Run:

   ```sh
   docker compose up -d
   ```

5. Install and authenticate `cloudflared`, create a tunnel, and route the
   hostname. A sample ingress file is in `cloudflare/config.example.yml`.

Cloudflare should bypass cache for `/api/*`, `/firebase-messaging-sw.js`, and
`/manifest.json`. Do not expose ports `80` or `3000` directly to the internet.

## Unraid

The GitHub workflow publishes:

```
ghcr.io/vbbot/chores:latest
```

Use `deploy/unraid/compose.yaml` with `deploy/unraid/chores.env.example`.
Place the Firebase service account at:

```
/mnt/user/appdata/chores/firebase-admin.json
```

The web container listens on port `3000`. The cron container uses the same
image and calls the web container internally.

The GHCR package is private by default. Either make it public in the package
settings, or log in on Unraid with a GitHub PAT that has `read:packages`:

```sh
docker login ghcr.io -u vbbot
```

## Verification

```sh
npm test          # shared domain tests
npm run e2e       # Firebase Auth + Firestore emulators, local Next server on 3001
```

`npm run e2e` never touches the production Firebase project. It requires:

- Firebase CLI (`npm install -g firebase-tools`).
- Java 21 for the Firestore emulator (`brew install openjdk@21` on macOS).

The harness starts the emulators, points the app at them, runs Playwright, and clears emulator data afterward. Direct `playwright test` runs are blocked unless the emulator harness is active.
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
