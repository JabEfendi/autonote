# RTK OpenCode Integration

## Date

2026-11-08

## Objective

Memeriksa dan memperbaiki integrasi RTK dengan OpenCode setelah output RTK terlihat tidak tersambung.

## Scope And Files Changed

- Global RTK/OpenCode configuration under `C:\Users\jabyo\.config\opencode`.
- RTK global installation and hook registration.
- This work-log entry and `docs/README.md`.

## Diagnosis

- `rtk.exe` tersedia di `C:\Users\jabyo\AppData\Local\Microsoft\WinGet\Links` dan dapat dijalankan.
- RTK mendukung `rtk hook opencode`.
- OpenCode version `1.18.35` memuat plugin `C:\Users\jabyo\.config\opencode\plugins\rtk.ts`.
- Sebelumnya plugin dan hook sudah ada, tetapi sesi OpenCode yang sedang berjalan tidak memuat ulang plugin setelah konfigurasi berubah.
- Perintah terminal yang dijalankan oleh tool internal sesi ini tidak melewati lifecycle plugin OpenCode, sehingga `rtk gain` tidak bertambah dari pemanggilan tersebut. Ini bukan bukti bahwa plugin OpenCode gagal.

## Implementation

- Menjalankan `rtk init -g --opencode --auto-patch` untuk menyelaraskan instalasi global RTK dan plugin OpenCode.
- Mempertahankan plugin resmi RTK di konfigurasi global, tanpa menambah plugin lokal yang duplikat.

## Verification

```text
rtk verify
151/151 tests passed

opencode debug info
plugins:
- file:///C:/Users/jabyo/.config/opencode/plugins/rtk.ts

rtk hook opencode "git status --short"
{"command":"rtk git status --short"}

Node execFile probe of rtk hook opencode
probe=true
```

## Known Limitations

- OpenCode memuat plugin sekali saat startup. Sesi yang sedang terbuka harus ditutup dan dibuka ulang untuk menggunakan plugin hasil konfigurasi terbaru.
- Penggunaan RTK hanya terlihat pada perintah yang dieksekusi melalui tool lifecycle OpenCode; pemanggilan langsung dari tool host tidak otomatis dihitung sebagai penggunaan RTK.

## Next PRs / Follow-up Tasks

1. Restart OpenCode sepenuhnya.
2. Jalankan `git status` dari sesi OpenCode baru dan pastikan command preview/log menunjukkan `rtk git status` atau hasil ringkas RTK.
3. Jika masih tidak aktif setelah restart, jalankan OpenCode dengan `--print-logs` dan periksa error pemuatan plugin di log startup.
