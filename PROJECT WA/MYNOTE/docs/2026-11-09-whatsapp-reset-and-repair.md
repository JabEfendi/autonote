# WhatsApp Session Reset And Re-Pair

## Date

2026-11-09

## Objective

Menambahkan alur "Pair ulang" agar sesi WhatsApp yang rusak (`MessageCounterError` / gagal dekripsi) bisa diganti langsung dari dashboard tanpa menghapus folder sesi secara manual.

## Scope And Files Changed

- `src/transport/baileys-client.ts`: `resetSession()` menunggu start yang berjalan, disconnect, rename `authDir` ke `authDir.backup-<timestamp>`, lalu connect ulang.
- `src/web/server.ts`: endpoint `POST /api/whatsapp/reset`.
- `src/web/app.js`: tombol "Pair ulang" di modal WhatsApp dan `resetWhatsAppSession()`; QR dirender dari `qrDataUrl` yang sudah tersedia.
- `docs/README.md`: index work log.

## Implementation

- Reset mencadangkan sesi lama (tidak menghapus) agar masih bisa dipulihkan.
- Setelah reset, `connect()` membuat auth state baru dan Baileys mengirim QR; status menjadi `connecting` dengan `qrDataUrl`.
- Modal WhatsApp sudah polling status tiap 1 detik dan menampilkan QR; setelah `connected`, modal ditutup dan dashboard di-refresh.
- Tidak ada kredensial yang ditulis ke log atau dokumentasi.

## Verification

```text
node --check src/web/app.js
passed

npm run build
passed

npm run lint
passed

npm test
29 passed, 2 skipped

POST /api/whatsapp/reset
{"status":"connecting","qrDataUrl":null,"error":null}

poll status
status=connecting qrLen=6846

auth/baileys.backup-2026-11-09T04-38-11-005Z dibuat
```

## Known Limitations

- QR tetap perlu dipindai manual dari HP bot.
- Sesi lama disimpan sebagai folder backup; bersihkan manual jika sudah yakin.
- Reset memutus koneksi sementara; pesan selama proses pairing tidak diproses.

## Next PRs / Follow-up Tasks

1. Tombol hapus backup sesi lama dari dashboard.
2. Indikator umur QR dan auto-refresh QR.
3. Tes penerimaan pesan teks dan voice setelah pairing dari akun WhatsApp lain.
