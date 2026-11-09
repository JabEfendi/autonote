# Web Log Container

## Date

2026-11-09

## Objective

Menambahkan container Log di halaman Pengaturan dashboard web agar pesan masuk dan error WhatsApp, processor, dan voice dapat dilihat langsung dari browser.

## Scope And Files Changed

- `src/application/log-store.ts`: ring buffer log dan capture stdout/stderr.
- `src/web/server.ts`: `installLogCapture()`, endpoint `GET /api/logs`, `DELETE /api/logs`, dan auto-connect WhatsApp saat start.
- `src/web/app.js`: container "Log Sistem" di Pengaturan, polling 3 detik, tombol Muat ulang dan Bersihkan.
- `src/web/styles.css`: styling container log.
- `src/transport/baileys-client.ts`: log metadata pesan masuk (`type`, `fromMe`, `ageMs`, `keys`, `voice`) dan pemrosesan pesan `append` yang masih baru (<= 15 menit).

## Implementation

- Log disimpan in-memory maksimal 400 entri, terbaru di atas.
- Capture mem-parsing log JSON Baileys dan hanya menyimpan `msg` + `err.message`; payload lengkap (termasuk kunci sesi) tidak disimpan.
- Nomor telepon/LID 10-15 digit disamarkan menjadi `***`. Group JID tetap ditampilkan agar mudah didiagnosis.
- Isi pesan tidak disimpan; hanya metadata dan error.
- Endpoint:
  - `GET /api/logs?limit=200`
  - `DELETE /api/logs`

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

GET /api/logs?limit=15 setelah start
entries: 7
[info] whatsapp: connected
[error] system: Session error: MessageCounterError: Key used already or never filled
[error] system: Failed to decrypt message with any known session...
[error] system: Session error: MessageCounterError: Key used already or never filled
[error] system: Failed to decrypt message with any known session...
```

## Findings

Log menunjukkan pesan tidak sampai ke processor karena gagal didekripsi (`MessageCounterError`). Ini masalah state sesi Signal pada linked device, bukan parser atau transcriber. Pesan dari akun bot sendiri (`me.lid`) tidak andal diterima oleh linked device. Perbaikan: re-pair sesi WhatsApp (rename/hapus `auth/baileys` lalu scan QR) dan/atau tes dari akun WhatsApp lain.

## Known Limitations

- Log in-memory dan hilang saat proses restart.
- Hanya menangkap output stdout/stderr proses web.
- Tidak menyimpan isi pesan, hanya metadata dan error.
- Log Baileys yang sangat verbose disaring menjadi `msg` dan `err.message`.

## Next PRs / Follow-up Tasks

1. Tambahkan tombol "Pair ulang" dan tampilkan QR pairing di dashboard.
2. Tampilkan `qrDataUrl` di modal koneksi saat status `connecting`.
3. Opsi menyimpan log ke file dengan rotasi.
4. Filter log berdasarkan level/sumber di UI.
