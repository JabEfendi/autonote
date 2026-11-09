# Workbook Styling

## Date

2026-11-08

## Objective

Menambahkan warna header, border tabel, zebra rows, freeze header, font yang lebih jelas, dan format angka ribuan pada template Excel operasional.

## Implementation

- Mengganti exporter workbook ke `exceljs` agar fill, font, border, alignment, freeze panes, dan number format benar-benar ditulis ke file `.xlsx`.
- Header tabel memakai teal `#0D5C5E` dengan font putih tebal.
- Baris data memakai zebra rows putih dan hijau muda.
- Semua sel tabel memakai border tipis hijau-abu.
- Kolom angka memakai format `#,##0`.
- Header dibekukan saat scrolling dan keterangan panjang memakai wrap text.
- `xlsx` tetap digunakan untuk pembacaan/import workbook referensi; `exceljs` hanya dipakai untuk export styled workbook.

## Verification

```text
npm test
20 passed, 2 skipped

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed

Styling assertion
Header fill, border, bold font, and number format verified by ExcelJS read-back
```

## Example Files

```text
reports/styled/garasi-2026-11-01-2026-11-08.xlsx
reports/styled/garasi-2026-11-01-2026-11-08.pdf
```

## Known Limitations

- File lama di `reports/garasi-2026-11-01-2026-11-08.xlsx` dapat terkunci jika sedang dibuka Excel; contoh styled ditulis ke `reports/styled/` untuk menghindari konflik file.
- `npm install` melaporkan vulnerability dependency transitive; tidak dijalankan `npm audit fix --force` karena dapat mengubah versi secara luas.

## Next PRs / Follow-up Tasks

1. Tambahkan form profil laporan di Pengaturan.
2. Tambahkan tombol unduh PDF di tab laporan web.
3. Tambahkan validasi visual dengan LibreOffice/Excel pada mesin operator.
