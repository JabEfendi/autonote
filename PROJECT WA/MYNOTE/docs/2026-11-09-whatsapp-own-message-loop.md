# WhatsApp Own-Message Loop And Duplicate History

## Date

2026-11-09

## Objective

Menghentikan loop pemrosesan pesan sendiri (`fromMe=true`) dan replay history sync yang membuat log dan pemrosesan berulang.

## Files Changed

- `src/config/index.ts`: `whatsappProcessFromMe` dari `WHATSAPP_PROCESS_FROM_ME` (default false).
- `src/transport/baileys-client.ts`: skip pesan `fromMe` kecuali diaktifkan, dedupe message ID (Set maksimal 1000, FIFO), dan filter `append` diperketat dari 15 menit menjadi 2 menit.
- `.env.example`: `WHATSAPP_PROCESS_FROM_ME=false`.

## Implementation

- Pesan dari akun bot sendiri diabaikan secara default, sehingga balasan bot tidak diproses ulang sebagai pesan masuk.
- ID pesan yang sudah diproses disimpan di memori (maksimal 1000, FIFO) untuk mencegah history sync memproses pesan yang sama berulang.
- Pesan `append` hanya diproses jika umurnya <= 2 menit.
- Idempotensi database tetap menjadi lapisan kedua lewat unique source message ID.

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

Verifikasi runtime manual: restart `npm run web`, lalu kirim pesan dari akun lain. Log tidak boleh menampilkan pemrosesan berulang untuk ID yang sama, dan pesan bot sendiri harus tercatat sebagai `skip own message`.

## Known Limitations

- Dedupe in-memory hilang saat restart; database tetap mencegah duplikasi record.
- Untuk testing dari akun bot sendiri, set `WHATSAPP_PROCESS_FROM_ME=true` sementara, tetapi risiko loop kembali.

## Next PRs / Follow-up Tasks

1. Tambahkan tes otomatis untuk filter `fromMe` dan dedupe.
2. Evaluasi penyebab `connection closed (status unknown)` setelah history sync jika masih berulang.
