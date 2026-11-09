# Per-Plate And Kas Harian Templates

## Date

2026-11-08

## Objective

Membuat sheet `Kas Harian` mengikuti `Template_Kas_Harian_Garasi_Lampung.xlsx` dan sheet per kendaraan mengikuti `Template_Laporan_Keuangan_Mobil_Heri.xlsx`, sehingga setiap plat memuat rincian pemasukan, pengeluaran, setoran, sparepart, dan total pendapatan.

## Scope And Files Changed

- `src/reporting/operational-workbook.ts`
- `tests/reporting/operational-workbook.test.ts`
- `tests/reporting/operational-workbook-style.test.ts`

## Implementation

- `Kas Harian` memakai judul `LAPORAN KEUANGAN GARASI LAMPUNG`, subjudul perusahaan dan jumlah unit, serta periode, lalu tabel enam kolom `NO, TANGGAL, KETERANGAN, PEMASUKAN, PENGELUARAN, SALDO AKHIR`.
- Sheet per kendaraan memakai judul `LAPORAN KEUANGAN`, identitas plat, dan periode, lalu tabel delapan kolom `TGL, KETERANGAN, KONTRAK, BORONGAN, SETORAN, SETORAN MASUK, SETORAN GANTUNG, SPAREPART`.
- Di bawah tabel ditambahkan ringkasan: `Setoran`, `Setoran Gantung`, `Setoran Masuk`, `Sparepart`, `Sisa Pendapatan`, daftar pengeluaran lain (operasional, fee, hospitality), lalu `Total Pendapatan`.
- Tanggal diformat `DD/MM/YYYY` agar konsisten dengan template referensi.

## Verification

```text
npm test
20 passed, 2 skipped

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed

Example
reports/styled/garasi-2026-11-01-2026-11-30.xlsx
```

## Known Limitations

- Pengeluaran tanpa plat kendaraan tidak muncul pada sheet per kendaraan, sehingga fee atau operasional generik tetap hanya terlihat di Kas Harian dan Rekap.
- Ringkasan per kendaraan memakai basis accrual, bukan kas, untuk menghitung Sisa Pendapatan.

## Next PRs / Follow-up Tasks

1. Tambahkan field driver agar identitas sheet per kendaraan bisa menampilkan nama driver seperti `[ BASE | DRIVER ]`.
2. Tambahkan master data untuk mengalokasikan fee dan biaya generik ke plat tertentu.
