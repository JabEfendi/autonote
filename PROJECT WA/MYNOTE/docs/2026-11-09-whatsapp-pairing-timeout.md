# WhatsApp Pairing Timeout

## Date

2026-11-09

## Objective

Membatasi status `connecting` agar tidak menggantung atau loading tanpa batas ketika QR pairing tidak dipindai.

## Files Changed

- `src/config/index.ts`: `whatsappPairingTimeoutMs` dari `WHATSAPP_PAIRING_TIMEOUT_MS` (default 120000, clamp 15000-600000).
- `src/transport/baileys-client.ts`: timer pairing; saat habis, socket ditutup, status menjadi `disconnected`, error "Waktu pairing habis...", lock dilepas, dan auto-reconnect dicegah.
- `src/web/app.js`: polling status global 5 detik, card koneksi ikut update, modal berhenti polling saat status bukan `connecting`, tombol "Coba lagi", tombol "Pair ulang" tetap ada.
- `.env.example`: `WHATSAPP_PAIRING_TIMEOUT_MS`.

## Implementation

- Timer dimulai saat socket dibuat dengan status `connecting`; dibersihkan saat `open`, `close`, dan `disconnect`.
- Timeout default 2 menit dan dapat diatur lewat environment variable.
- Modal WhatsApp menampilkan QR selama `connecting`; setelah timeout menampilkan pesan error dan berhenti polling.
- Card WhatsApp di halaman Pengaturan ikut berubah menjadi CONNECT melalui polling 5 detik tanpa perlu refresh halaman.
- Pesan error timeout dipertahankan saat socket ditutup manual oleh timer.

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
```

Verifikasi runtime manual: jalankan `npm run web`, biarkan QR tanpa dipindai; setelah 2 menit status harus menjadi `disconnected` dengan error "Waktu pairing habis. Klik Connect untuk QR baru."

## Known Limitations

- Timer hanya menghentikan percobaan pairing, bukan memperbaiki sesi yang rusak; gunakan "Pair ulang" untuk sesi rusak.
- QR tetap harus dipindai manual dari HP bot.

## Next PRs / Follow-up Tasks

1. Tampilkan hitung mundur sisa waktu pairing di modal.
2. Tambahkan tes otomatis untuk transisi timeout.
