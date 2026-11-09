# Project Status And Continuation Plan

## Date

2026-11-10

## Objective

Merekam posisi MYNOTE saat ini setelah rangkaian pekerjaan 4-9 November 2026, lalu menetapkan urutan pekerjaan berikutnya. Entri ini adalah checkpoint ringkas; detail per perubahan tetap ada di entri tanggal masing-masing.

## Verification Run

Dijalankan dari `PROJECT WA/MYNOTE` pada 2026-11-10:

```text
npm test
Test Files  10 passed | 1 skipped (11)
Tests       29 passed | 2 skipped (31)

npm run build
passed

npm run lint
passed
```

Dua test yang dilewati adalah test integrasi PostgreSQL di `tests/persistence/postgres.integration.test.ts`. Test tersebut hanya berjalan bila `POSTGRES_TEST_URL` diset. Web server tidak dijalankan pada sesi ini.

## Current Baseline

### Transport

- Baileys sebagai transport WhatsApp, QR pairing, reset/re-pair sesi, dan timeout pairing.
- Telegram Bot API long polling (opsional, aktif lewat env).
- Voice note lokal memakai `faster-whisper` (`large-v3-turbo`, bahasa Indonesia) melalui worker Python persisten.
- Pesan `fromMe` diabaikan secara default, dedupe message ID di memori, dan idempotensi database lewat `source_message_id`.
- Otorisasi hanya untuk Group ID / chat ID yang dikonfigurasi.

### Application And Domain

- Parser deterministik: format `#catat`, ledger natural, command laporan, dan periode `Asia/Jakarta`.
- Ledger natural mengenali: sparepart (oli, besi pipa, pompa solar, selang solar), service/bengkel, parkir, operasional, makan/rokok tamu, BPJS, bulanan garasi, fee makelar/herman, setoran, muat, tagihan muat, borongan, transfer, plat kendaraan, rute, quantity, dan installment.
- Status ledger `pending`, `posted`, `cancelled` dengan transisi yang divalidasi.
- Validasi income dan expense tidak boleh sama-sama positif.
- Perintah `!rules`, `!laporan <periode>` (XLSX + PDF), `#laporan pdf|excel <periode>`.

### Persistence

- PostgreSQL sebagai sumber data utama.
- Migration terpisah di `src/persistence/migrations/` dengan tabel `schema_migrations`:
  - `001_initial.sql`
  - `002_ledger_audit.sql`
  - `003_settlement.sql`
  - `004_report_profile.sql`
  - `005_source_message_dedup.sql`
- Tabel utama: `messages`, `records`, `daily_cash_transactions`, `audit_log`, `allowed_groups`, `command_formats`, `report_profiles`.
- Unique index penuh pada `source_message_id`.
- Ordering transaksi eksplisit: `transaction_date, created_at, id`.
- Audit log untuk create, update, cancel, restore, dan report generation.
- Report profile: nama perusahaan, nama laporan, jumlah unit, saldo awal.

### Reporting

- Workbook operasional: styling, format angka `#,##0`, sheet `Rekap Garasi` dan `Rekonsiliasi`.
- PDF laporan kas lokal.
- Laporan kendaraan diturunkan dari ledger yang sama (bukan transaksi terpisah).

### Web Dashboard

- Route Overview, Transaksi, Laporan, Pengaturan.
- Status/koneksi/reset/disconnect WhatsApp, pemilihan grup, command format, report profile.
- Koreksi transaksi, cancel/restore dengan alasan, dan endpoint audit log.
- Container Log Sistem in-memory (metadata dan error, nomor disamarkan).
- Graceful shutdown (`SIGINT`/`SIGTERM`).

### MCP

- Server MCP read-only: daftar grup, validasi pesan, query record terbatas, summary, generate laporan lokal, health check.

## Phase Status Against Roadmap

| Phase | Status | Catatan |
| --- | --- | --- |
| 1 - Stabilize Ledger Foundation | Hampir selesai | Migration/versioning, ordering, koreksi, cancel/restore, audit, unique source message, validasi, transisi status, dan test concurrent duplicate sudah ada. Sisa: jalankan integration test dengan DB nyata dan audit untuk import saat fitur import dibuat. |
| 2 - Master Data Garasi | Belum mulai | Belum ada tabel/CRUD `companies`, `garages`, `vehicles`, `drivers`, `routes`, `vendors`, `categories`, `subcategories`, `settlement_terms`. Masih memakai field teks bebas. |
| 3 - Parser Natural Deterministik | Sebagian besar | Pola utama sudah dikenali. Belum ada state confidence/ambiguity (ambigu masuk `pending`), response koreksi per field yang kurang, alias kategori yang dikelola, dan test typo/multiline/duplikasi nominal/arah transfer. |
| 4 - Laporan Kas Harian | Sebagian besar | Opening balance dari report profile, PDF/XLSX, format angka, dan API `from`/`to` sudah ada. Belum: date-range picker di UI, styling saldo negatif eksplisit, dan ringkasan validasi selisih total/saldo. |
| 5 - Laporan Bulanan Kendaraan | Sebagian | `vehicle-report.ts` menurunkan laporan dari ledger. Belum ada `vehicle_contracts`, `vehicle_receivables`, `vehicle_settlements`, sheet per kendaraan bulanan, dan filter periode/kendaraan di UI. |
| 6 - Rekap Garasi | Sebagian | Sheet `Rekap Garasi` dan `Rekonsiliasi` sudah ada. Belum ada charts, export rekap, perbandingan periode, dan rekonsiliasi penuh. |
| 7 - Workbook Import And Replacement | Belum mulai | Menunggu file `.xlsx` asli, penjelasan saldo awal, formula bisnis, dan mapping master data. |
| 8 - Web Operations And Security | Belum mulai | Belum ada auth web, CSRF/origin checks, role, audit viewer UI, rate limit, health status semua komponen, dan dokumentasi backup/restore. Graceful shutdown sudah ada. |
| 9 - Verification Gate | Sebagian | Unit test/build/lint lulus. Integration test PostgreSQL masih di-skip dan verifikasi manual WhatsApp/laporan belum dijalankan ulang. |

## Known Gaps And Risks

- Test integrasi PostgreSQL belum dijalankan pada DB nyata pada sesi ini, sehingga dedupe konkuren dan running balance baru terbukti lewat kode, belum lewat eksekusi terbaru.
- Parser ledger memakai regex dan heuristik; belum ada mekanisme `pending` untuk input ambigu, sehingga input yang salah bisa langsung masuk `posted` bila lolos validasi minimal.
- Master data kendaraan/driver/rute belum ada; laporan kendaraan masih bergantung pada pencocokan teks plat.
- Web belum punya autentikasi. Jangan bind ke selain localhost sebelum Phase 8.
- Laporan kendaraan dan rekap garasi belum punya tabel kontrak/piutang/setoran tersendiri, sehingga beberapa metrik masih diturunkan dari field ledger.
- Workbook import belum bisa dimulai tanpa file asli dan keputusan aturan bisnis.
- Voice note bergantung pada kualitas audio dan model lokal; verifikasi suara manusia nyata di grup masih perlu.

## Next PRs / Follow-up Tasks

Urutan yang disarankan:

1. **Tutup Phase 1**: jalankan `tests/persistence/postgres.integration.test.ts` dengan `POSTGRES_TEST_URL` pada PostgreSQL lokal, lalu catat hasilnya.
2. **Hardening parser (Phase 3)**: tambahkan state ambigu/pending, response koreksi field yang kurang, alias kategori yang tersimpan, dan test typo, multiline, duplikasi nominal, serta arah transfer.
3. **Polish laporan kas (Phase 4)**: date-range picker di UI, styling saldo negatif, dan ringkasan validasi total/saldo.
4. **Master data (Phase 2)**: tabel dan CRUD `vehicles`, `drivers`, `routes`, `vendors`, `categories`; hubungkan `vehicle_id`, `driver_id`, `route_id`, `vendor_id`, `category_id` sebagai foreign key nullable sambil menyimpan label asli.
5. **Laporan kendaraan (Phase 5)**: tabel kontrak/piutang/setoran, query bulanan per kendaraan, dan filter periode/kendaraan.
6. **Rekap garasi (Phase 6)**: agregasi, charts dari data nyata, export rekap, dan perbandingan periode.
7. **Workbook import (Phase 7)**: inventaris sheet/formula dan mapping kolom setelah file asli tersedia.
8. **Keamanan web (Phase 8)**: auth, CSRF/origin, role, audit viewer, rate limit, health status, dan dokumentasi backup/restore.
9. **Verification gate (Phase 9)**: lengkapi test yang masih kurang dan jalankan verifikasi manual WhatsApp serta unduh laporan.

## Open Questions

Pertanyaan ini masih terbuka dan jangan dijawab dengan asumsi sebelum data operasional tersedia:

- Saldo awal setiap periode berasal dari mana?
- Apakah `TAGIHAN MUAT` adalah pelunasan piutang atau pendapatan baru pada sebagian kasus?
- Bagaimana membedakan borongan dan kontrak pada chat singkat?
- Bagaimana transaksi tanpa plat kendaraan dialokasikan ke laporan kendaraan?
- Apakah fee dan setoran selalu menjadi pengeluaran kas pada hari pencatatan?
- Apakah laporan perusahaan memakai basis cash atau accrual untuk pendapatan?
- Apakah satu transaksi dapat memiliki lebih dari satu kendaraan atau rute?
