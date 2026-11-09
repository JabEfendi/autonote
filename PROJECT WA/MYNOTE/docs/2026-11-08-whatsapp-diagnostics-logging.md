# WhatsApp Diagnostics Logging

## Date

2026-11-08

## Objective

Menelusuri laporan pengguna bahwa `!rules` tidak dibalas, lalu menambah log koneksi dan penerimaan pesan agar masalah serupa mudah didiagnosis tanpa membocorkan isi pesan.

## Findings

- Logika `!rules` benar. Simulasi processor memakai grup resmi `120363430603431644@g.us` ("Mynote") menghasilkan status `rules_sent` dan mengirim teks panduan.
- Proses `npm run dev` (`tsx src/app.ts`) sedang berjalan dan terhubung ke server WhatsApp (koneksi TLS established ke server Meta).
- Hanya satu grup yang diizinkan di `allowed_groups`: `120363430603431644@g.us` ("Mynote"), `enabled = TRUE`.
- `ALLOWED_GROUP_IDS` di `.env` kosong, sehingga otorisasi bergantung pada tabel `allowed_groups`.
- Tidak ada baris pesan `!rules` di tabel `messages`, yang konsisten dengan kode baru: `!rules` dibalas sebelum pesan disimpan.
- Akar masalah ditemukan: pengguna menjalankan `npm run dev` dan `npm run web` bersamaan. Keduanya membuka sesi WhatsApp yang sama (`AUTH_DIR`), sehingga ada dua koneksi TLS ke server Meta dari satu kredensial dan keduanya saling membatalkan handshake.
- Bukti: endpoint `/api/whatsapp/status` mengembalikan `{"status":"connecting","qrDataUrl":null,"error":null}` (macet), dan `creds.json` terus ditulis ulang oleh dua proses.
- Kemungkinan penyebab lain: pesan dikirim dari grup/DM yang tidak diizinkan (diabaikan diam-diam).

## Scope And Files Changed

- `src/transport/baileys-client.ts`
- `src/app.ts`

## Implementation

- Log `[whatsapp] connected` dan `[whatsapp] closed (status ...)` saat status koneksi berubah.
- Log `[whatsapp] message from <groupId> (<n> chars)` setiap pesan grup diterima.
- Isi teks hanya dicetak jika `LOG_MESSAGE_CONTENT=true`.
- Kegagalan memproses pesan ditangkap dan dicatat (`[whatsapp] message handling failed: ...`) agar tidak menjadi unhandled rejection.
- Log `[processor] <status> group=<groupId>` di `src/app.ts`, sehingga status `ignored`, `rules_sent`, `report`, `duplicate`, dan lainnya terlihat.
- Mode headless `npm run dev` sekarang mencetak QR ke terminal (`QRCode.toString` tipe `terminal`) saat pairing dibutuhkan, dan mencetak perubahan status `[whatsapp] status: ...` setiap 2 detik.
- Ini memperbaiki masalah mode headless yang sebelumnya diam saja saat sesi tidak terautentikasi karena `printQRInTerminal: false`.
- Menambahkan kunci sesi tunggal `auth/baileys/.session.lock` berisi PID. Jika PID lain masih hidup dan memegang kunci, `connect()` menolak dengan status `error` dan pesan: jalankan hanya satu dari `npm run web` atau `npm run dev`.
- Kunci dilepas saat `disconnect()`, saat `logged_out`, dan pada event `process exit`. Kunci basi (PID sudah mati) otomatis dianggap bebas.

## Verification

```text
npm test
23 passed, 2 skipped

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed
```

## Known Limitations

- Log grup masih menampilkan JID grup; ini bukan nomor pribadi tetapi tetap identifier.
- Belum ada rotasi atau level log terstruktur; masih memakai `console`.

## Next PRs / Follow-up Tasks

1. Tambahkan mode log terstruktur (level `info`/`warn`/`error`) yang bisa diatur dari `.env`.
2. Tambahkan perintah diagnostik `!status` yang membalas status koneksi dan grup aktif.
3. Pertimbangkan balasan ringkas untuk grup tak diizinkan hanya jika `LOG_MESSAGE_CONTENT=true`, tanpa mencatat transaksi.
