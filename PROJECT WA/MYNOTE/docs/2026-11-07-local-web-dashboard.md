# Local Web Dashboard

## Date

2026-11-07

## Objective

Add a first browser-facing view for MYNOTE so the operator can inspect the local system, financial summary, category distribution, and recent records before continuing the transport rollout.

## Scope

- Added `src/web/server.ts`, a dependency-free local HTTP server.
- Added responsive dashboard assets under `src/web/index.html`, `src/web/styles.css`, and `src/web/app.js`.
- Added a bounded dashboard query to `PostgresRepository`.
- Added `WEB_HOST`, `WEB_PORT`, and `npm run web` configuration.

## Implementation

The dashboard is served locally and uses `/api/dashboard` to read the current month's records and summary from PostgreSQL. It renders a focused command-center layout with database status, last sync time, balance, income, expense, transaction count, category distribution, and recent transactions. The UI includes empty and database-error states and adapts for mobile screens.

No frontend framework or external runtime service was added. Google Fonts are referenced for visual typography when network access is available; the layout remains usable with fallback fonts when it is not.

## Usage

```text
npm run web
Open http://127.0.0.1:3000
```

The port and bind address can be changed with `WEB_PORT` and `WEB_HOST`. PostgreSQL must be available for live data; otherwise the dashboard displays its error state.

## Verification

```text
npm test
9 tests passed

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed
```

## Known Limitations

- The current web surface is read-only; adding or editing records remains chat-driven.
- The server has no authentication and should remain bound to `127.0.0.1` until an authentication layer is added.
- Live browser verification and PostgreSQL-backed rendering require the local PostgreSQL service to be running.

## Next PRs / Follow-up Tasks

1. Add web authentication before exposing the server beyond localhost.
2. Add report download buttons and a transaction filtering screen.
3. Add a transport status endpoint that reports WhatsApp and Telegram connection state.
