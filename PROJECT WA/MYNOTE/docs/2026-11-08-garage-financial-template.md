# Garage Financial Template

## Date

2026-11-08

## Objective

Membaca referensi workbook keuangan garasi `assets/Input Laporan Keuangan Tahunan.xlsx` dan membangun template Excel yang meniru strukturnya namun disesuaikan dengan ledger `daily_cash_transactions` yang sudah ada.

## Scope And Files Changed

- `src/reporting/operational-workbook.ts`

## Reference Structure

Workbook referensi berisi sheet ringkasan dan sheet per kendaraan:

- `Operasional thn`: total operasional per bulan.
- `Operasional plat`: detail pengeluaran operasional per kendaraan.
- `Rank mobil pengeluaran sparepar`: ranking pengeluaran sparepart per kendaraan.
- `Sparepart acutahun`: detail pengeluaran sparepart per kendaraan.
- Sheet per kendaraan dengan kolom `TGL`, `KETERANGAN`, `KONTRAK`, `BORONGAN`, `SETORAN`, `SETORAN MASUK`, `SETORAN GANTUNG`, `SPAREPART`.

## Implementation

- Workbook operasional diperluas menjadi satu template yang mencakup `Ringkasan`, `Kas Harian`, `Rekap Kategori`, `Operasional Bulanan`, `Operasional per Plat`, `Rank Pengeluaran Sparepart`, `Sparepart per Plat`, `Transaksi`, sheet per kendaraan, dan `Petunjuk`.
- Sheet per kendaraan meniru kolom referensi `TGL | KETERANGAN | KONTRAK | BORONGAN | SETORAN | SETORAN MASUK | SETORAN GANTUNG | SPAREPART`.
- Pemetaan deterministik dari ledger: pemasukan `Muat` menjadi `KONTRAK`, pemasukan `Tagihan muat` menjadi `SETORAN MASUK`, dan pengeluaran sparepart atau service menjadi `SPAREPART`.
- `SETORAN` dihitung sebagai `KONTRAK - BORONGAN`, dan `SETORAN GANTUNG` sebagai `SETORAN - SETORAN MASUK`.
- `BORONGAN` belum berasal dari data karena ledger belum punya field terpisah; kolom dibiarkan kosong dengan nilai nol di baris total.
