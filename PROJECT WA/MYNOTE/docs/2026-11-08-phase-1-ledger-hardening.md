# Phase 1 Ledger Hardening

## Date

2026-11-08

## Objective

Melanjutkan checkpoint Phase 1 dengan memisahkan migration PostgreSQL, menambah audit dan status transition ledger, menyediakan koreksi/pembatalan/pemulihan, serta memastikan urutan saldo stabil.

## Scope And Files Changed

- `src/persistence/migrations/001_initial.sql`
- `src/persistence/migrations/002_ledger_audit.sql`
- `src/persistence/postgres.ts`
- `src/domain/ledger-models.ts`
- `src/web/server.ts`
- `tests/domain/ledger-status.test.ts`

## Implementation

- DDL awal dipindahkan dari schema inline ke migration SQL bernomor.
- Ditambahkan `schema_migrations` dan runner migration idempotent berbasis urutan nama file.
- Migration ledger menambahkan `cancel_reason`, `cancelled_at`, `updated_at`, dan index status/order.
- Insert ledger sekarang transaksional, tetap idempotent berdasarkan `source_message_id`, dan menulis audit `create` setelah insert berhasil.
- Ditambahkan koreksi transaksi melalui `PATCH /api/ledger/:id`.
- Ditambahkan pembatalan melalui `POST /api/ledger/:id/cancel` dengan alasan wajib dan pemulihan melalui `POST /api/ledger/:id/restore`.
- Ditambahkan endpoint pembacaan ledger dan audit log.
- Status transition yang didukung: `pending -> posted`, `pending -> cancelled`, `posted -> cancelled`, dan `cancelled -> posted`.
- Laporan kas mengurutkan transaksi berdasarkan `transaction_date`, `created_at`, lalu `id`, sehingga saldo berjalan stabil untuk tanggal yang sama.
- Report generation dicatat ke audit log.

## Verification

```text
npm test
17 tests passed

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed

Export smoke test
Generated reports/garasi-2026-11-08-2026-11-08.xlsx
Generated reports/mynote-2026-11-08-2026-11-08.pdf

git check-ignore -v
.env, auth/, reports/*, and dist/ are ignored
```

## Known Limitations

- Repository integration tests against a running PostgreSQL instance are not yet automated in Vitest.
- Migration compatibility with every existing pre-ledger database version still needs a staging database rehearsal.
- Web endpoints do not yet have authentication, CSRF/origin protection, or role authorization.
- Correction payload validation is intentionally minimal; a dedicated domain validator should be added before exposing the web server beyond localhost.
- The report metadata is still hard-coded and remains a Phase 2 report-profile task.

## Next PRs / Follow-up Tasks

1. Add PostgreSQL integration tests for migration, concurrent duplicate insert, cancellation, restore, audit rows, and running balance.
2. Add domain validation for correction requests and reject income/expense conflicts with a clear `400` response.
3. Add configurable report profiles and opening balances.
4. Continue to Phase 2 master tables for vehicles, drivers, routes, vendors, and categories.
5. Add web controls for correction, cancellation, restore, and audit history after local authorization is implemented.
