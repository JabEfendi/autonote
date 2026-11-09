# Report Recap, Profile, And Integration Tests

## Date

2026-11-08

## Objective

Menyelesaikan sisa Phase 1 dan Phase 4 yang konkret: menambah format angka, sheet Rekap Garasi dan Rekonsiliasi cash vs accrual, profil laporan yang dapat dikonfigurasi, serta uji integrasi PostgreSQL yang menemukan dan memperbaiki bug deduplikasi ledger.

## Scope And Files Changed

- `src/reporting/operational-workbook.ts`
- `src/persistence/migrations/004_report_profile.sql`
- `src/persistence/migrations/005_source_message_dedup.sql`
- `src/persistence/postgres.ts`
- `src/web/server.ts`
- `tests/persistence/postgres.integration.test.ts`

## Implementation

- Workbook kini menerapkan format angka ribuan `#,##0` pada kolom moneter, dan menambah sheet `Rekap Garasi` dan `Rekonsiliasi` untuk memperlihatkan bedanya pendapatan accrual kontrak dengan kas masuk tagihan muat.
- Ditambahkan tabel `report_profiles` dan endpoint `GET/PUT /api/report-profile` agar nama perusahaan, nama laporan, jumlah unit, dan saldo awal dapat dikonfigurasi; laporan kas memakai profil ini.
- Ditambahkan uji integrasi PostgreSQL yang menjalankan migration, deduplikasi, running balance, cancel/restore, audit, dan concurrent duplicate insert. Uji otomatis dilewati bila `POSTGRES_TEST_URL` tidak diset.
- Uji integrasi menemukan bug: indeks unik `source_message_id` bersifat partial sehingga `ON CONFLICT (source_message_id)` gagal di PostgreSQL. Migration 005 mengganti indeks partial dengan indeks unik penuh.
