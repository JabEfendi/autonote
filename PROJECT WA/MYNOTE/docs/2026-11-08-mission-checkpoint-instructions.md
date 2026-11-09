# Mission Checkpoint Instructions

## Date

2026-11-08

## Objective

Menetapkan instruksi workspace dan proyek agar perintah "lanjutkan misi" selalu melanjutkan pengembangan MYNOTE dari catatan kerja terbaru.

## Scope And Files Changed

- `AGENTS.md`
- `PROJECT WA/MYNOTE/AGENTS.md`
- `PROJECT WA/MYNOTE/docs/README.md`
- `PROJECT WA/MYNOTE/docs/2026-11-08-mission-checkpoint-instructions.md`

## Implementation

- Menetapkan `PROJECT WA/MYNOTE` sebagai proyek aktif di level workspace.
- Menambahkan prosedur membaca aturan proyek, indeks dokumentasi, catatan bertanggal terbaru, dan roadmap sebelum melanjutkan misi.
- Menetapkan `docs/2026-11-07-garage-ledger-and-reports.md` sebagai checkpoint awal sebelum catatan ini dibuat.
- Menambahkan instruksi yang sama ke aturan lokal MYNOTE.

## Verification

- Memastikan `AGENTS.md` root dapat dibaca dan menunjuk ke proyek MYNOTE.
- Memastikan `PROJECT WA/MYNOTE/AGENTS.md` berisi prosedur resume dan kewajiban memperbarui dokumentasi.
- Memastikan indeks `docs/README.md` akan memuat catatan ini sebagai entri terbaru.

## Known Limitations

- Instruksi memilih catatan terbaru berdasarkan nama file bertanggal `YYYY-MM-DD`; jika ada beberapa catatan pada tanggal sama, pilih catatan yang paling relevan setelah membaca indeks dan waktu modifikasi.
- Root workspace berisi banyak proyek referensi sehingga aturan lokal dari subproyek lain tetap berlaku saat bekerja di subproyek tersebut.

## Next PRs / Follow-up Tasks

1. Saat pengguna meminta "lanjutkan misi", mulai dari catatan ini.
2. Reconcile `docs/ROADMAP.md` Phase 1 dengan follow-up ledger pada catatan `2026-11-07-garage-ledger-and-reports.md`.
3. Implementasikan migration ledger, cancellation, audit, duplicate handling, dan running-balance tests sebelum menambah UI baru.
