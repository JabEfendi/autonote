# Settlement And Borongan Fields

## Date

2026-11-08

## Objective

Memisahkan pemasukan `Muat` dan `Tagihan muat` secara terstruktur lewat field baru, serta menangkap nilai borongan agar `SETORAN` dihitung sebagai `KONTRAK - BORONGAN` tanpa bergantung pada teks deskripsi.

## Scope And Files Changed

- `src/domain/ledger-models.ts`
- `src/domain/parser/ledger-parser.ts`
- `src/persistence/migrations/003_settlement.sql`
- `src/persistence/postgres.ts`
- `src/reporting/operational-workbook.ts`
- `src/web/server.ts`
- `tests/parser/ledger-parser.test.ts`
- `tests/reporting/operational-workbook.test.ts`

## Implementation

- Menambah `settlement_kind` (`contract` atau `collection`) dan `borongan_amount` ke model ledger serta migration nomor 003.
- Parser kini membedakan `Muat` sebagai kontrak dan `Tagihan muat` sebagai penagihan, serta membaca besaran borongan dari teks `borongan <nominal>`.
- Deteksi nominal utama dilakukan setelah teks borongan dikeluarkan, sehingga nominal kontrak dan borongan tidak tertukar.
- Repository menyimpan dan mengembalikan `settlement_kind` dan `borongan_amount` untuk laporan dan endpoint koreksi.
- Workbook sheet per kendaraan menghitung `SETORAN = KONTRAK - BORONGAN` dari field terstruktur, dengan fallback lama hanya untuk data yang belum memiliki `settlement_kind`.
- Endpoint `PATCH /api/ledger/:id` menerima `settlementKind` dan `boronganAmount`.
