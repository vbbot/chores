# ChoreSync

A self-hosted household management Progressive Web App for chores, bin
collections, shopping, bills, calendar events, and shared notes.

## Quick Start

1. Copy the environment file and configure it:

   ```sh
   cp .env.example .env
   ```

2. Generate VAPID keys for push notifications:

   ```sh
   npx web-push generate-vapid-keys
   ```

   Put the keys in `.env` as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Leave
   `API_URL` empty when the app is served through nginx on one origin.

3. Start the stack:

   ```sh
   docker compose up -d --build
   ```

4. Open http://localhost.

The database schema is created on backend startup. Push notifications and
service worker install require HTTPS in production, or `localhost` in
development.

## Verification Loop

The agentic loop starts the stack, runs the backend tests, drives a real
Chromium browser through the full household journey, captures screenshots for
every route, and fails on console errors or failed API calls.

```sh
make verify
```

Outputs:

- `frontend/artifacts/screenshots/<project>/` for visual review
- `frontend/artifacts/report.json` for machine-readable results
- `frontend/artifacts/html-report/` for the Playwright report

Run only the browser journey with `make e2e`. Run only backend tests with
`make test`.

## Development

```sh
# Database, Redis, and backend
docker compose up db redis backend -d

# Frontend (set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local)
cd frontend && npm install && npm run dev

# Backend tests
docker compose exec backend pytest -q
```

## Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, PWA
- **Backend**: FastAPI, SQLAlchemy 2.0, Celery
- **Database**: PostgreSQL 16
- **Cache/Broker**: Redis 7
- **Proxy**: Nginx
