# Garage Ledger And Operational Reports

## Date

2026-11-07

## Objective

Expand MYNOTE from a generic note parser into a garage transaction ledger supporting daily cash reporting, vehicle performance reporting, garage consolidation, deterministic natural-message parsing, running balances, and a cleaner operational workbook.

## Implementation

- Added `daily_cash_transactions` and `daily_cash_reports` PostgreSQL structures.
- Added one source ledger with income, expense, and transfer transaction types.
- Added categories, subcategories, vehicle plate, route, counterparty, quantity, unit, and settlement installment fields.
- Added a unique source-message index to prevent duplicate WhatsApp events from creating duplicate ledger rows.
- Added running-balance calculation in transaction order; cancelled rows are excluded by status.
- Added `parseLedgerMessage` for vehicle spareparts, service payments, shipment/tagihan muat, operational expenses, commissions, settlements, transfers, quantities, routes, and Indonesian amount suffixes.
- Added daily cash report endpoint with report metadata and six-column cash table semantics.
- Added vehicle report endpoint from the same ledger.
- Added a new operational workbook generator with `Metadata`, `Kas Harian`, `Rekap Kategori`, and `Petunjuk` sheets.
- Added web report tabs for Kas Harian, Bulanan Kendaraan, and Rekap Garasi.

## Workbook Source Audit

No original garage workbook was found in the workspace. Existing spreadsheet files belong to unrelated repository fixtures. The new workbook is therefore generated from the blueprint and is designed as the clean replacement structure. Formula-level parity with the original workbook still requires the original `.xlsx` file, including its opening balance, formulas, hidden sheets, and transaction ordering.

## Verification

```text
npm test
13 tests passed

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed
```

## Known Limitations

- Vehicle, driver, route, contract, receivable, and installment master tables are represented first through ledger fields; full master-data foreign keys and monthly vehicle sections remain the next schema increment.
- The natural parser is deterministic and deliberately conservative. Unknown descriptions are not silently classified as valid transactions.
- Report metadata currently uses the requested default name, company, and 10 units; operator-configurable report metadata should be added before production use.
- Workbook formulas are generated from the ledger output, but original workbook parity cannot be proven without the original workbook.
- Web report dates currently use the API defaults; a date-range picker and opening-balance form should be added.

## Next PRs / Follow-up Tasks

1. Import and map the original workbook once provided.
2. Add vehicle, driver, route, contract, receivable, and garage master tables with foreign keys.
3. Add correction, cancellation, and audit endpoints.
4. Add monthly vehicle workbook sheets for contracts, borongan, setoran, piutang, and income.
5. Add fixture-based workbook comparison tests against the original operational file.
