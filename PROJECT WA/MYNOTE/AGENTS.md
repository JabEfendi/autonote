# MYNOTE Agent Instructions

## Project Purpose

MYNOTE is a self-hosted WhatsApp note and reporting system. It receives messages from an approved WhatsApp group, parses structured notes, stores records locally, and produces Excel or PDF reports.

## Continue Mission

When the user says "lanjutkan misi", resume from the newest dated entry in `docs/`:

1. Open `docs/README.md` and read the ordered work log.
2. Open the newest dated entry (highest `YYYY-MM-DD` filename). Its "Next PRs / Follow-up Tasks" section is the last recorded continuation point.
3. Open `docs/ROADMAP.md` and reconcile its "Suggested Next Session" with that section.
4. State the checkpoint you are continuing from before writing code.
5. When the work is done, add a new dated entry and update `docs/README.md`.

## Core Constraints

- Use free and open-source software only.
- Do not add paid WhatsApp APIs, SaaS automation services, or cloud-only dependencies.
- Use Baileys as the WhatsApp transport unless the project owner explicitly changes this decision.
- Use PostgreSQL as the default local database. The first deployment target is a local PostgreSQL instance.
- Use SheetJS for `.xlsx` generation.
- Generate PDF files locally.
- Keep Google Sheets and Google Drive optional. They are not part of the free core path.
- Never commit WhatsApp session credentials, tokens, `.env` files, or generated personal data.

## Runtime And Process Control

- The project owner runs the application manually. Do not start `npm run web`, `npm run dev`, or any long-running server in the background unless the user explicitly asks for that exact command in the current request.
- If verification needs the running app, ask the user to start it, or run it only with explicit permission and stop it immediately after the check.
- Never leave `npm run web` or `npm run dev` running after a task. If you started one with permission, stop it and remove `auth/baileys/.session.lock` if it is stale.
- Do not run `npm run web` and `npm run dev` at the same time; they share `auth/baileys`.

## Technical Direction

The preferred runtime is Node.js with TypeScript.

The system should be divided into these boundaries:

- `transport`: Baileys connection, authentication, incoming messages, and outgoing messages.
- `application`: use cases such as record note, confirm note, and generate report.
- `domain`: parsing rules, validation, categories, status values, and report filters.
- `persistence`: PostgreSQL schema, migrations, repositories, and idempotency checks.
- `reporting`: Excel and PDF exporters.
- `config`: environment variables and allowed WhatsApp group settings.

Business logic must not depend directly on Baileys message objects. Convert incoming events into an internal message model at the transport boundary.

## WhatsApp Rules

- Process messages only from explicitly configured group IDs.
- Prefer group IDs over group names because names can change.
- Ignore messages from unauthorized groups.
- Use a dedicated WhatsApp number for the bot.
- Do not implement spam, mass messaging, scraping, or unsolicited broadcasts.
- Keep outgoing responses short and rate-limited.
- Handle reconnects and duplicate events safely.
- Use the message ID as an idempotency key.

## Message Processing Rules

The first parser must be deterministic. Do not require an AI service for the MVP.

Supported commands should include:

- `#catat` for creating a record.
- `#laporan hari ini` for a daily report.
- `#laporan minggu ini` for a weekly report.
- `#laporan bulan ini` for a monthly report.
- `#laporan pdf <periode>` for a PDF report.
- `#laporan excel <periode>` for an Excel report.

Example record format:

```text
#catat
tanggal: 04/11/2026
jenis: pengeluaran
kategori: operasional
keterangan: pembelian ATK
nominal: 250000
```

If a record is incomplete or invalid, do not write it to the database as a completed record. Return a clear correction message.

## Data Integrity

- Store the raw WhatsApp message before parsing.
- Store the parsed result and parser status.
- Enforce a unique constraint on the source message ID.
- Store timestamps in UTC and render them in `Asia/Jakarta` for users.
- Use decimal-safe handling for monetary values. Do not use floating-point arithmetic for stored amounts.
- Keep failed messages and parsing errors available for diagnosis.
- Make report generation read-only.

## Security and Privacy

- Store Baileys authentication data outside source control.
- Restrict generated reports to the requesting group or authorized sender.
- Validate file paths and report parameters.
- Do not log message contents by default in production.
- Redact phone numbers and message bodies in error logs where possible.
- Add a `.gitignore` before creating runtime data.

## Editing Guidance

- Prefer the smallest correct change.
- Do not introduce a cloud dependency to solve a local problem.
- Do not add backward-compatibility layers without a concrete persisted-data requirement.
- Add tests for parser rules, duplicate handling, permissions, and report totals.
- Keep user-facing messages in Indonesian unless the project owner requests another language.
- Use ASCII in source files unless a non-ASCII character is required by user-facing content.

## Documentation and Work Tracking

- The `docs/` directory is the project work log and development documentation area.
- After every completed task, feature, bug fix, refactor, configuration change, or verification session, add or update a Markdown entry in `docs/` before reporting the work as complete.
- Each work entry must state the date, objective, files or areas changed, implementation explanation, verification performed, known limitations, and the next PRs or follow-up tasks required for continued development.
- Use descriptive filenames such as `YYYY-MM-DD-<topic>.md`. Do not overwrite an older work entry when the work represents a separate task.
- Keep `docs/README.md` or an index file updated when adding a new work entry so the project history is easy to find.
- Record unfinished work explicitly under a `Next PRs / Follow-up Tasks` heading. Include dependencies, risks, and the suggested implementation order when known.
- Documentation must not contain WhatsApp session credentials, access tokens, `.env` values, raw personal message content, full phone numbers, or generated personal data.
- A task is not complete until both the code verification and the corresponding documentation entry are finished.

## Required Verification

Before considering a feature complete:

- Run the formatter and linter for changed files.
- Run unit tests for parser and persistence behavior.
- Verify duplicate WhatsApp events do not create duplicate records.
- Verify unauthorized groups cannot create records or request reports.
- Generate one valid `.xlsx` and one valid `.pdf` from test data.
- Confirm credentials and generated personal data are ignored by Git.
