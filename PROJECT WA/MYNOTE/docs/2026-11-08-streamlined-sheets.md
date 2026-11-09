# Streamlined Workbook Sheets

## Date

2026-11-08

## Objective

Merampingkan template Excel dengan menghapus sheet yang duplikat dan menggabungkan view per kendaraan, agar laporan pemilik lebih cepat dibaca tanpa kehilangan data sumber.

## Scope And Files Changed

- `src/reporting/operational-workbook.ts`

## Implementation

- Menghapus sheet `Sparepart per Plat` dan `Transaksi`.
- Menggabungkan `Rank Pengeluaran Sparepart` ke `Operasional per Plat` menjadi satu sheet dengan kolom `NO, PLAT, TOTAL PENGELUARAN, SPAREPART & SERVICE, OPERASIONAL, PEMASUKAN, JML TRANSAKSI`, diurutkan dari sparepart terbesar.
- Rincian sparepart tetap tersedia di sheet per kendaraan, dan seluruh detail transaksi tetap tersimpan di PostgreSQL.
