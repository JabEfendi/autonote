# PostgreSQL Persistence Migration

## Date

2026-11-04

## Objective

Replace the initial SQLite persistence implementation with a local PostgreSQL deployment so MYNOTE can use a more durable database foundation and the operator only needs to provide PostgreSQL connection values in `.env`.

## Scope

- Removed the `better-sqlite3` and SQLite type dependencies.
- Added the `pg` driver and PostgreSQL type definitions.
- Added PostgreSQL settings to `.env.example`:
  - host;
  - port;
  - database;
  - user;
  - password;
  - SSL flag;
  - pool size.
- Replaced `src/persistence/sqlite.ts` with `src/persistence/postgres.ts`.
- Added automatic PostgreSQL table and index initialization on application startup.
- Added parameterized queries for record filtering and bounded limits.
- Added PostgreSQL transactions for message and record persistence.
- Preserved source message idempotency with a unique constraint.
- Updated application services, MCP server, exporters, README, MCP design, implementation plan, and agent instructions.
- Removed the unused SQLite data placeholder.

## Database Setup

The operator must create the local database first, for example:

```sql
CREATE DATABASE mynote;
```

Then copy `.env.example` to `.env` and fill in the PostgreSQL values. MYNOTE creates its application tables and indexes automatically when `src/app.ts` or `src/mcp/server.ts` starts.

No password or other secret is stored in the repository or returned by the health tool.

## Verification

The following checks are required after dependency installation:

```text
npm install
npm test
npm run build
```

Parser tests remain independent of PostgreSQL. A live database integration test is still pending because it requires a configured local PostgreSQL instance.

## Known Limitations

- The database connection cannot be fully smoke-tested until local PostgreSQL is running and `.env` is populated.
- Schema initialization is currently startup-based; a versioned migration runner is still recommended before production use.
- PostgreSQL repository tests with a temporary or dedicated test database are not yet present.
- Existing development data from the former SQLite implementation is not migrated automatically.

## Next PRs / Follow-up Tasks

1. Add versioned PostgreSQL migrations instead of relying only on startup schema creation.
2. Add repository integration tests against a local test database or disposable PostgreSQL container.
3. Add PostgreSQL backup and restore commands/documentation using `pg_dump` and `pg_restore`.
4. Add graceful pool shutdown for the application and MCP process.
5. Add database connection diagnostics that expose safe status only, never credentials.
