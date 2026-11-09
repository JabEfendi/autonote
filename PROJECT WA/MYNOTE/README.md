# MYNOTE

MYNOTE is a free, self-hosted WhatsApp and Telegram note and reporting system. It accepts deterministic `#catat` messages from configured chats, stores records in local PostgreSQL, and generates local PDF/XLSX reports.

## Setup

```bash
npm install
copy .env.example .env
npm test
npm run build
```

Set `ALLOWED_GROUP_IDS` to explicit WhatsApp group JIDs and/or Telegram chat IDs before starting the application. Authentication data, `.env`, and generated reports are excluded from Git. Telegram uses the official Bot API over long polling and is enabled only when `TELEGRAM_ENABLED=true` and `TELEGRAM_BOT_TOKEN` are configured.

## Web Dashboard

Jalankan dashboard lokal yang membaca data dari PostgreSQL:

```bash
npm run web
```

Buka `http://127.0.0.1:3000`. Halaman yang tersedia adalah `#overview`, `#transactions`, `#reports`, dan `#settings`. Dashboard tidak menyediakan data contoh atau mode simulasi; PostgreSQL harus aktif dan terkonfigurasi.

## Stage 1 Commands

Send one of these commands from an allowed chat:

```text
#catat
tanggal: 04/11/2026
jenis: pengeluaran
kategori: operasional
keterangan: pembelian ATK
nominal: 250000

!rules
!laporan hari ini
!laporan minggu ini
!laporan bulan ini
#laporan pdf bulan ini
#laporan excel bulan ini
```

`!laporan <periode>` sends both an Excel and a PDF file. `#laporan pdf|excel <periode>` still requests a single format.

WhatsApp authenticates with a QR code on first startup and stores its session under `AUTH_DIR`. Telegram does not require a local session directory.

## Voice Notes

Voice parsing is optional and fully local. It uses `faster-whisper` (Whisper models) through a persistent Python worker.

```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install faster-whisper
```

Then set in `.env`:

```text
VOICE_ENABLED=true
VOICE_PYTHON=.venv\Scripts\python.exe
VOICE_MODEL=large-v3-turbo
VOICE_LANGUAGE=id
VOICE_DEVICE=cpu
VOICE_COMPUTE_TYPE=int8
```

The first voice note downloads the model (for example `large-v3-turbo`, about 1.5 GB) and may take several minutes on CPU. `large-v3-turbo` is the recommended balance for CPU; use `VOICE_MODEL=large-v3` for maximum accuracy or `medium` for lower resource usage. Indonesian is supported out of the box (`VOICE_LANGUAGE=id`). Optional `VOICE_INITIAL_PROMPT` and `VOICE_HOTWORDS` bias the model toward garage vocabulary and numeric formatting; set them empty to disable. Transcription happens only for authorized groups. Voice notes with a clear transaction sentence are parsed by the same text rules.

## MCP

Run `npm run mcp` and configure an MCP client to execute `node dist/mcp/server.js` with this directory as its working directory. The server exposes only read-oriented tools: group listing, message validation, bounded record queries, summaries, local report generation, and health checks. It never exposes credentials or arbitrary filesystem paths.

The Baileys adapter is isolated under `src/transport`; application and domain code do not depend on Baileys message objects.
