# Voice Parsing

## Date

2026-11-08

## Objective

Menambahkan parsing pesan suara (voice note WhatsApp) sehingga transkrip voice dapat diproses oleh parser teks yang sudah ada, menggunakan STT lokal yang akurat tanpa API berbayar.

## Engine Choice

- Menggunakan `faster-whisper` (implementasi CTranslate2 dari Whisper) karena akurasi tinggi dan berjalan offline.
- Model default `large-v3-turbo`: akurasi mendekati `large-v3` tetapi jauh lebih cepat di CPU. Alternatif: `large-v3` untuk akurasi maksimum atau `medium` untuk kebutuhan resource lebih rendah.
- Worker Python persisten memuat model sekali, lalu melayani banyak permintaan lewat JSON line pada stdin/stdout.

## Scope And Files Changed

- `src/config/index.ts`: konfigurasi voice (`VOICE_*`).
- `src/transport/voice-transcriber.ts`: klien Node yang mengelola worker Python.
- `scripts/voice-worker.py`: worker `faster-whisper`.
- `src/transport/message-adapter.ts`: field `voice` dan `loadAudio`.
- `src/transport/baileys-client.ts`: deteksi `audioMessage`, sediakan `loadAudio`.
- `src/application/services.ts`: `transcribeVoice()`.
- `src/application/process-incoming-message.ts`: alur voice setelah otorisasi grup.
- `tests/transport/voice-transcriber.test.ts`, `tests/application/process-incoming-message.test.ts`, `tests/fixtures/fake-voice-worker.mjs`.

## Flow

1. Baileys mendeteksi `audioMessage`.
2. Transport membuat `IncomingMessage` dengan `voice=true` dan `loadAudio` (unduhan lazy).
3. Processor mengecek otorisasi grup terlebih dahulu.
4. Jika `VOICE_ENABLED=false`, bot membalas bahwa voice belum aktif.
5. Jika aktif, bot membalas `Voice diterima, sedang ditranskripsi...`.
6. Audio diunduh, dikirim ke worker Python, lalu transkrip menjadi `message.text`.
7. Transkrip diproses oleh parser teks yang sama (`!rules`, `!laporan`, `#catat`, ledger natural).
8. Balasan sukses diberi akhiran `(voice)`.

Audio tidak diunduh atau ditranskripsi untuk grup yang tidak diizinkan.

## Configuration

```text
VOICE_ENABLED=false
VOICE_PYTHON=python
VOICE_SCRIPT=./scripts/voice-worker.py
VOICE_MODEL=large-v3-turbo
VOICE_LANGUAGE=id
VOICE_DEVICE=cpu
VOICE_COMPUTE_TYPE=int8
VOICE_TIMEOUT_MS=600000
VOICE_INITIAL_PROMPT=Catatan bengkel dan garasi. Plat nomor, oli mesin, setoran, borongan, parkir, bengkel. Nominal ditulis angka rupiah.
VOICE_HOTWORDS=oli mesin, borongan, setoran, parkir, bengkel, plat nomor, pompa solar, besi pipa, BPJS, fee makelar
```

## Verification

```text
npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed

npm test
29 passed, 2 skipped

Smoke test
.venv + faster-whisper 1.2.1, model tiny, WAV 1 detik
RESULT {"text":"","language":"id","durationMs":1000}
```

Smoke test memakai model `tiny` dan audio tone (bukan ucapan), sehingga teks kosong adalah hasil yang wajar; ini memvalidasi pemuatan model, dekode audio, protokol JSON, dan pengembalian hasil.

```text
Transkripsi audio nyata (TTS Windows), model large-v3-turbo
lang=en prob=1.0
text="Vehicle B 9474 Jin, engine oil 2 liters, 130,000 rupiah"
```

```text
E2E Node VoiceTranscriber -> voice-worker.py -> large-v3-turbo
E2E {"text":"Vehicle B 9474 Jin, engine oil 2 liters, 130,000 rupiah","language":"en","durationMs":8063}
```

Model `large-v3-turbo` sudah diunduh ke cache Hugging Face (sekitar 1.5 GB) sehingga voice note pertama tidak perlu mengunduh ulang.

## Indonesian Accuracy

Tes dengan TTS Indonesia (`id-ID-ArdiNeural` dan `id-ID-GadisNeural`), model `large-v3-turbo`, `VOICE_LANGUAGE=id`, plus `initial_prompt` dan `hotwords` kosakata bengkel:

```text
B 9474 JIN, oli mesin dua liter seratus tiga puluh ribu
=> B 9474 Jin, oli mesin 2 liter Rp130.000.

Catat pengeluaran parkir lima puluh ribu rupiah
=> Catat pengeluaran parkir 50 ribu rupiah.

Setoran lima ratus ribu rupiah
=> Setoran 500 ribu rupiah.

Muat Jakarta ke Surabaya borongan dua juta rupiah
=> Muat Jakarta ke Surabaya borongan 2 juta rupiah.
```

```text
E2E Node VoiceTranscriber -> voice-worker.py (VOICE_LANGUAGE=id, prompt+hotwords)
ID-E2E {"text":"B 9474 Jin, oli mesin 2 liter Rp130.000.","language":"id","durationMs":5856}
```

Whisper menulis nominal sebagai angka, sehingga parser ledger yang ada dapat mengenali plat, kategori, jumlah, dan nominal. `VOICE_INITIAL_PROMPT` dan `VOICE_HOTWORDS` dapat dikosongkan untuk menonaktifkan bias kosakata.

Catatan: tes memakai TTS karena mesin ini tidak memiliki voice SAPI Indonesia; akurasi suara manusia nyata tetap perlu diverifikasi di grup.

## Known Limitations

- Model `large-v3` di CPU bisa lebih lambat dari realtime; `large-v3-turbo` jauh lebih cepat tetapi voice panjang tetap butuh waktu.
- Voice note pertama mengunduh model jika belum ada di cache (sekitar 1.5 GB untuk `large-v3-turbo`).
- Akurasi bergantung pada kualitas audio, aksen, dan model yang dipilih.
- Angka dan plat nomor dari voice bisa salah transkripsi; pengguna disarankan mengetik data sensitif.
- Worker berjalan per proses aplikasi; jika `npm run web` dijalankan dobel, model dapat termuat dua kali.

## Next PRs / Follow-up Tasks

1. Tambahkan perintah `!voice status` untuk menampilkan model, device, dan status worker.
2. Tambahkan opsi `VOICE_MODEL_DIR` agar model disimpan di folder proyek.
3. Tambahkan pra-pemanasan worker saat startup opsional untuk menghindari delay voice pertama.
4. Bandingkan `large-v3` vs `large-v3-turbo` pada audio pelanggan nyata untuk memilih default akhir.
