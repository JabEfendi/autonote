# Web Live Data Cleanup

## Date

2026-11-07

## Objective

Remove all runtime demo data and simulation behavior from the web dashboard.

## Changes

- Removed the demo data fixture and `WEB_DEMO_MODE` configuration.
- Made `/api/dashboard` always use the PostgreSQL repository.
- Made web startup always initialize and close PostgreSQL.
- Removed dummy transaction creation, placeholder report downloads, reset-demo behavior, and simulated connection completion.
- Replaced the fake WhatsApp QR with an explicit unavailable state until an actual Baileys QR endpoint is connected.
- Kept the Telegram Bot Token form informational and disabled its connect action until secure backend validation exists.
- Removed demo-only UI labels and old demo work-log links.

## Verification

```text
npm test
9 tests passed

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed
```

## Known Limitations

- The web dashboard now requires a reachable PostgreSQL instance.
- WhatsApp QR streaming from Baileys to the web has not been implemented yet.
- Telegram token validation from the web has not been implemented yet.
- Web report generation and download endpoints have not been implemented yet.

## Next PRs / Follow-up Tasks

1. Connect the web to the actual Baileys session and stream its QR code.
2. Add secure backend Telegram token validation.
3. Add authenticated web report endpoints using the existing exporters.
