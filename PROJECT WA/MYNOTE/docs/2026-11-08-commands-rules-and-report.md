# Commands, Rules, And Combined Report

## Date

2026-11-08

## Objective

Menambah command bantuan `!rules` dan mengubah `!laporan` agar sekali permintaan menghasilkan dua file sekaligus: Excel dan PDF.

## Scope And Files Changed

- `src/domain/parser/report-parser.ts`
- `src/application/process-incoming-message.ts`
- `tests/domain/report-parser.test.ts`

## Implementation
- `!rules` membalas dengan panduan format parsing, contoh pencatatan natural, contoh kontrak muat, tagihan muat, transfer, format nominal, dan cara meminta laporan.
- `!laporan <periode>` menghasilkan dan mengirim dua dokumen: `.xlsx` dan `.pdf`.
- `#laporan <periode>` juga menghasilkan dua file secara default.
- `#laporan pdf <periode>` dan `#laporan excel <periode>` tetap bekerja untuk permintaan satu format.
- Periode yang didukung: `hari ini`, `minggu ini`, `bulan ini`.
