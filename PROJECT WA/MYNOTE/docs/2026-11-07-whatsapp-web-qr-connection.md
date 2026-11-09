# WhatsApp Web QR Connection

## Date

2026-11-07

## Objective

Connect the web WhatsApp button to the actual Baileys session and display a scannable QR code in the browser.

## Implementation

- Added `BaileysConnectionManager` with explicit connection status, QR data URL, reconnect handling, credential persistence, and message processing.
- Disabled terminal QR output for web-started sessions.
- Added `POST /api/whatsapp/connect` to start the session.
- Added `GET /api/whatsapp/status` to return the current status and QR data URL.
- Added `POST /api/whatsapp/disconnect` for cleanup.
- Added QR rendering through the `qrcode` package.
- Updated the web modal to poll status and render the actual Baileys QR when available.

## Usage

```text
npm run web
Open http://127.0.0.1:3000/#settings
Click CONNECT on WhatsApp
Scan the displayed QR from WhatsApp > Perangkat tertaut
```

The web server must be able to access the configured `AUTH_DIR`. If a valid saved session exists, the status can become `CONNECTED` without showing a QR.

## Verification

```text
npm test
npm run build
npm run lint
```

All checks passed during implementation. Live QR scanning still requires a real WhatsApp account and network access.

## Known Limitations

- The QR status is currently polled once per second rather than streamed over SSE/WebSocket.
- Web authentication is not implemented; keep `WEB_HOST=127.0.0.1`.
- Only group messages are processed by the existing business rules.
