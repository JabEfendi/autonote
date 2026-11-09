# MYNOTE Development Roadmap

## Purpose

Dokumen ini adalah rencana pembangunan utama MYNOTE setelah fondasi WhatsApp, web dashboard, PostgreSQL, parser deterministik, ledger garasi, dan workbook operasional awal tersedia.

Gunakan dokumen ini sebagai titik lanjut utama. Setiap tahap harus menghasilkan perubahan kode, test, dan catatan kerja baru di `docs/`.

## Current Baseline

Status yang sudah tersedia:

- WhatsApp transport menggunakan Baileys.
- QR WhatsApp aktual dapat ditampilkan melalui web.
- Session Baileys tersimpan lokal di `AUTH_DIR`.
- Authorization grup WhatsApp dapat dipilih berdasarkan nama grup dan disimpan sebagai Group ID.
- PostgreSQL repository dan schema initialization.
- Web dashboard lokal dengan route Overview, Transaksi, Laporan, dan Pengaturan.
- Tidak ada data demo runtime.
- Command format dapat dikelola dari web dan disimpan di PostgreSQL.
- Ledger kas `daily_cash_transactions`.
- Running balance laporan kas.
- Parser natural deterministik untuk nominal, kendaraan, rute, sparepart, service, shipment, komisi, setoran, dan transfer.
- Endpoint laporan kas harian dan laporan kendaraan.
- Generator workbook operasional awal.
- Test suite berjalan dengan `npm test`, `npm run build`, dan `npm run lint`.

## Important Decisions

- PostgreSQL adalah sumber data utama.
- Baileys tetap menjadi transport WhatsApp.
- Tidak memakai WhatsApp Cloud API berbayar.
- Tidak menggunakan AI untuk parser MVP; parser harus deterministic dan dapat diaudit.
- Satu transaction ledger menjadi sumber untuk semua laporan.
- Laporan kas harian, laporan bulanan kendaraan, dan laporan rekap garasi adalah view berbeda, bukan tiga transaksi berbeda.
- Nama grup hanya untuk tampilan; Group ID tetap identitas authorization.
- Saldo berjalan dihitung dari urutan transaksi, bukan diedit bebas per baris.
- Transfer tidak masuk total pendapatan atau pengeluaran perusahaan.
- Transaksi cancelled tidak masuk saldo dan total laporan.
- Token, credential WhatsApp, raw personal messages, dan generated personal reports tidak boleh masuk Git atau dokumentasi.

## Phase 1 - Stabilize Ledger Foundation

### Objective

Menjadikan ledger kas aman untuk data operasional nyata sebelum menambah modul kendaraan dan laporan kompleks.

### Tasks

- Pisahkan migration PostgreSQL dari schema inline di `postgres.ts`.
- Tambahkan migration versioning dan migration status table.
- Tambahkan transaction ordering eksplisit berdasarkan `transaction_date`, `created_at`, dan `id`.
- Tambahkan endpoint koreksi transaksi.
- Tambahkan endpoint pembatalan transaksi dengan alasan dan audit log.
- Tambahkan audit log untuk create, update, cancel, restore, import, dan report generation.
- Pastikan `source_message_id` unik lintas pesan WhatsApp dan channel lain.
- Tambahkan validasi bahwa income dan expense tidak boleh sama-sama positif.
- Tambahkan status transition yang sah: `pending -> posted`, `pending -> cancelled`, `posted -> cancelled`.
- Tambahkan test concurrent duplicate insert.

### Acceptance Criteria

- Dua event WhatsApp dengan message ID sama menghasilkan satu ledger row.
- Transaksi cancelled tidak muncul dalam total atau saldo.
- Perubahan transaksi menghitung ulang saldo setelah transaksi tersebut.
- Semua perubahan memiliki audit log.
- Migration dapat dijalankan pada database baru dan database existing.

## Phase 2 - Master Data Garasi

### Objective

Mengubah field bebas menjadi master data yang dapat dirujuk dan divalidasi.

### Tables

- `companies`
- `garages`
- `vehicles`
- `drivers`
- `routes`
- `vendors`
- `categories`
- `subcategories`
- `settlement_terms`
- `report_profiles`

### Tasks

- Tambahkan `vehicle_id`, `driver_id`, `route_id`, `vendor_id`, dan `category_id` sebagai foreign key nullable.
- Simpan label asli dari chat untuk audit dan fallback.
- Tambahkan CRUD master data dari web.
- Tambahkan validasi plat kendaraan.
- Tambahkan status kendaraan aktif/nonaktif.
- Tambahkan konfigurasi perusahaan, jumlah unit, nama laporan, dan saldo awal per report profile.

### Acceptance Criteria

- Laporan kendaraan memakai `vehicle_id`, bukan hanya pencocokan teks plat.
- Kategori laporan berasal dari master data.
- Nama perusahaan, jumlah unit, dan saldo awal dapat dikonfigurasi.
- Penghapusan master data tidak merusak transaksi historis.

## Phase 3 - Parser Natural Deterministik

### Objective

Menerima format chat operasional yang ringkas tanpa mengorbankan auditability.

### Supported Patterns

- Plat kendaraan + sparepart.
- Pengeluaran service dan vendor.
- Shipment dan tagihan muat.
- Parkir, operasional, makan, rokok tamu, BPJS, bulanan garasi.
- Fee makelar dan fee personal.
- Setoran bertahap dengan `installment_number`.
- Transfer antar akun.
- Format terstruktur lama `#catat`.
- Alias command dari `command_formats`.

### Tasks

- Pisahkan tokenizer, amount parser, entity extractor, classifier, dan validator.
- Tambahkan kamus alias kategori yang dapat dikelola.
- Bedakan `MUAT` dan `TAGIHAN MUAT` secara eksplisit.
- Identifikasi arah transfer sebelum menyimpan transaksi.
- Tambahkan confidence/ambiguity state tanpa memakai AI.
- Pesan ambigu masuk `pending`, bukan langsung `posted`.
- Tambahkan response koreksi dengan field yang kurang.
- Simpan raw input hanya di database, tidak di log produksi.

### Acceptance Criteria

- Contoh parser dari blueprint menghasilkan struktur yang sesuai.
- Nominal `130rb`, `3,15 juta`, dan `6 juta` benar.
- Vendor, rute, kendaraan, quantity, dan installment number benar.
- Unknown phrase tidak diam-diam menjadi kategori valid.
- Test mencakup typo, format multiline, duplikasi nominal, dan transfer.

## Phase 4 - Laporan Kas Harian

### Objective

Membuat laporan kas yang konsisten dengan format operasional perusahaan.

### Output

- Metadata: nama laporan, perusahaan, jumlah unit, periode, saldo awal.
- Kolom transaksi: NO, TANGGAL, KETERANGAN, PEMASUKAN, PENGELUARAN, SALDO AKHIR.
- Total pemasukan.
- Total pengeluaran.
- Saldo akhir.
- Validasi selisih total dan saldo.

### Tasks

- Tambahkan date-range picker web.
- Tambahkan opening-balance input yang mengambil nilai report profile.
- Tambahkan daily, weekly, monthly period presets.
- Tambahkan PDF generator dengan header dan footer operasional.
- Tambahkan XLSX generator dengan formula atau nilai terverifikasi.
- Tambahkan negative balance styling.
- Tambahkan report validation summary.

### Acceptance Criteria

- Saldo akhir = saldo awal + total income - total expense.
- Saldo negatif tetap ditampilkan.
- Periode laporan tidak menerima transaksi di luar tanggal.
- Transaksi tanggal sama memiliki urutan stabil.
- PDF dan XLSX memiliki total yang sama dengan query ledger.

## Phase 5 - Laporan Bulanan Kendaraan

### Objective

Menampilkan performa keuangan per kendaraan tanpa menggandakan transaksi.

### Sections

- Identitas kendaraan.
- Kontrak.
- Borongan.
- Pendapatan.
- Setoran.
- Setoran masuk.
- Setoran gantung.
- Sparepart.
- Service.
- Biaya operasional.
- Piutang.
- Net performance.

### Tasks

- Tambahkan transaction dimensions untuk contract, borongan, settlement, receivable, dan vehicle expense.
- Tambahkan tabel `vehicle_contracts`.
- Tambahkan tabel `vehicle_receivables`.
- Tambahkan tabel `vehicle_settlements`.
- Tambahkan monthly vehicle report query.
- Tambahkan workbook sheets per kendaraan.
- Tambahkan filter per periode dan kendaraan.

### Acceptance Criteria

- Satu transaksi muncul di kas harian dan laporan kendaraan melalui relasi yang sama.
- Total biaya kendaraan dapat direkonsiliasi dengan total pengeluaran kas.
- Setoran termin tidak menjadi kategori terpisah per nomor.
- Piutang belum dibayar tidak dihitung sebagai kas masuk.

## Phase 6 - Rekap Garasi

### Objective

Menyediakan konsolidasi manajemen dari ledger yang sama.

### Metrics

- Total pendapatan.
- Total pengeluaran.
- Saldo kas.
- Piutang.
- Biaya kendaraan.
- Performa kendaraan.
- Top categories.
- Shipment income by route.
- Service and sparepart cost.

### Tasks

- Tambahkan query agregasi garasi.
- Tambahkan dashboard charts berbasis data nyata.
- Tambahkan export rekap garasi.
- Tambahkan perbandingan periode.
- Tambahkan rekonsiliasi terhadap laporan kas dan laporan kendaraan.

### Acceptance Criteria

- Rekap tidak membuat row ledger baru.
- Total rekap dapat ditelusuri ke laporan kas.
- Perbedaan antara cash income dan accrued income terlihat jelas.
- Transfer internal tidak menggelembungkan performa.

## Phase 7 - Workbook Import And Replacement

### Objective

Memetakan workbook asli dan menghasilkan workbook baru yang lebih rapi tanpa kehilangan formula bisnis.

### Required Input

- File `.xlsx` asli.
- Sheet yang dianggap sumber transaksi.
- Penjelasan saldo awal.
- Formula atau contoh hasil yang dianggap benar.
- Mapping nama kendaraan, driver, vendor, dan rute.

### Tasks

- Inventaris semua sheet, named ranges, hidden sheets, merged cells, formulas, styles, dan validations.
- Identifikasi sheet transaksi, master, summary, dan archive.
- Bandingkan tanggal laporan dengan tanggal transaksi.
- Import workbook ke staging tables.
- Buat mapping kolom lama ke ledger baru.
- Validasi total income, expense, dan closing balance.
- Generate workbook replacement dengan layout bersih.
- Simpan import batch dan error rows.
- Tambahkan comparison report old-vs-new.

### Acceptance Criteria

- Semua row workbook lama memiliki status import: imported, skipped, atau rejected.
- Total September/Oktober tidak tercampur tanpa alasan eksplisit.
- Saldo akhir workbook baru sama dengan workbook asli untuk fixture yang disepakati.
- Formula dan metadata penting terdokumentasi.
- Workbook baru dapat dibuka di Excel dan LibreOffice.

## Phase 8 - Web Operations And Security

### Tasks

- Tambahkan authentication web sebelum bind selain localhost.
- Tambahkan CSRF/origin checks untuk mutation endpoints.
- Tambahkan authorization role: owner, operator, viewer.
- Tambahkan audit viewer.
- Tambahkan rate limit untuk WhatsApp responses.
- Tambahkan health status WhatsApp, Telegram, PostgreSQL, dan report worker.
- Tambahkan graceful shutdown.
- Tambahkan backup/restore documentation.
- Redact token dan raw message dari log.

### Acceptance Criteria

- Web tidak dapat mengubah data tanpa user terotorisasi.
- Token tidak pernah masuk response, log, atau docs.
- Backup dapat dipulihkan di database baru.
- Shutdown tidak meninggalkan transaksi setengah selesai.

## Phase 9 - Verification Gate

Sebelum menyatakan sistem production-ready:

- `npm test` lulus.
- `npm run build` lulus.
- `npm run lint` lulus.
- Test duplicate WhatsApp event lulus.
- Test unauthorized group lulus.
- Test cancelled transaction lulus.
- Test running balance lulus.
- Test negative balance lulus.
- Test transfer exclusion lulus.
- Test period boundary timezone lulus.
- Test workbook export lulus.
- Test PDF export lulus.
- Test import workbook lulus.
- Manual QR pairing lulus.
- Manual group selection lulus.
- Manual valid chat parsing lulus.
- Manual correction flow lulus.
- Manual report download lulus.

## Suggested Next Session

Status per 2026-11-10: Phase 1 hampir selesai. Lihat `docs/2026-11-10-project-status-and-continuation.md` untuk rincian. Urutan lanjutan:

1. Jalankan integration test PostgreSQL dengan `POSTGRES_TEST_URL` untuk menutup Phase 1.
2. Hardening parser: state ambigu/pending, response koreksi per field, alias kategori, dan test typo/multiline/duplikasi nominal/arah transfer.
3. Polish laporan kas: date-range picker, styling saldo negatif, dan ringkasan validasi total/saldo.
4. Tambahkan master data `vehicles`, `drivers`, `routes`, `vendors`, dan `categories`.
5. Lanjut laporan kendaraan dan rekap garasi, lalu workbook import setelah file asli tersedia.
6. Keamanan web (auth, CSRF/origin, role) sebelum bind selain localhost.

## Open Questions

Jangan menebak jawaban berikut sebelum data operasional tersedia:

- Saldo awal setiap periode berasal dari mana?
- Apakah `TAGIHAN MUAT` merupakan pelunasan piutang atau pendapatan baru pada sebagian kasus?
- Bagaimana membedakan borongan dan kontrak pada chat singkat?
- Bagaimana transaksi tanpa plat kendaraan dialokasikan ke laporan kendaraan?
- Apakah fee dan setoran selalu menjadi pengeluaran kas pada hari pencatatan?
- Apakah laporan perusahaan memakai basis cash atau accrual untuk pendapatan?
- Apakah satu transaksi dapat memiliki lebih dari satu kendaraan atau rute?
