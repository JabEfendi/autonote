# Stage 1 Transport Integration

## Date

2026-11-07

## Objective

Complete the first application stage: receive authorized messages from WhatsApp and Telegram, normalize them into the shared message model, persist them through the existing application flow, reply to users, and deliver generated PDF/XLSX reports.

## Scope

- WhatsApp transport in `src/transport/baileys-client.ts`.
- Telegram Bot API long polling in `src/transport/telegram-client.ts`.
- Shared transport contracts in `src/transport/message-adapter.ts`.
- Report period calculation in `src/domain/periods.ts`.
- Command routing in `src/application/process-incoming-message.ts`.
- Environment configuration and setup documentation.
- Authorization, period, and report parser tests.

## Implementation

WhatsApp messages are accepted only from group chats and are normalized with a transport-qualified idempotency key. Telegram accepts group and supergroup messages through long polling when explicitly enabled. Both transports use the same `IncomingMessage`, `MessageResponder`, parser, authorization, persistence, and report-generation flow.

The processor now handles `#catat` responses, invalid-message correction responses, and the supported `#laporan` commands. Report files are sent back to the originating authorized chat. WhatsApp authentication remains local under `AUTH_DIR`; Telegram uses only its bot token and does not add a paid or cloud storage dependency.

## Verification

```text
npm test
9 tests passed

npm run build
TypeScript compilation passed

npm run lint
TypeScript no-emit check passed
```

The automated checks cover parser behavior, report command parsing, Jakarta-local period boundaries, and explicit chat authorization. Live QR pairing, Telegram token validation, PostgreSQL connectivity, and document delivery still require credentials and running local services, so they were not performed in this verification session.

## Known Limitations

- The configured `ALLOWED_GROUP_IDS` must contain the actual WhatsApp group JIDs and/or Telegram numeric chat IDs before messages are accepted.
- Telegram requires `TELEGRAM_ENABLED=true` and `TELEGRAM_BOT_TOKEN`.
- Live transport smoke tests need a dedicated WhatsApp number, Telegram bot, and local PostgreSQL instance.
- The persistence layer still stores monetary values in JavaScript numbers after reading PostgreSQL `BIGINT`; this is safe for the current expected range but should be changed to a decimal-safe representation before very large amounts are supported.

## Next PRs / Follow-up Tasks

1. Run an operator smoke test with real WhatsApp QR pairing and a Telegram group.
2. Add repository integration tests for duplicate events and unauthorized groups against a disposable PostgreSQL database.
3. Add fixture-based PDF/XLSX validation and report delivery tests.
4. Add graceful shutdown and transport health state reporting.
