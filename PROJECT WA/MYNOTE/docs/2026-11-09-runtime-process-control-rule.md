# Runtime Process Control Rule

## Date

2026-11-09

## Objective

Menetapkan aturan bahwa aplikasi (`npm run web` / `npm run dev`) hanya dijalankan manual oleh pemilik proyek, bukan dinyalakan di latar belakang oleh agent.

## Files Changed

- `AGENTS.md`: menambahkan section "Runtime And Process Control".

## Implementation

- Agent tidak boleh menyalakan server long-running di background tanpa permintaan eksplisit pada request saat itu.
- Jika verifikasi membutuhkan aplikasi berjalan, minta user menjalankannya, atau jalankan hanya dengan izin lalu segera hentikan.
- Jangan meninggalkan proses berjalan; hapus `auth/baileys/.session.lock` jika stale.
- Jangan menjalankan `npm run web` dan `npm run dev` bersamaan karena berbagi `auth/baileys`.

## Verification

- Semua proses MYNOTE dihentikan.
- Port 3000 bebas.
- Lock sesi dihapus.

## Known Limitations

- Aturan bergantung pada kepatuhan agent; belum ada enforcement otomatis.

## Next PRs / Follow-up Tasks

1. Opsional: skrip `npm run status` untuk melihat proses, port, dan lock.
