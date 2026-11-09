# MYNOTE Implementation Plan

## Goal

Build a free, self-hosted system that receives structured notes from a WhatsApp group, stores them in local PostgreSQL, applies rules, and returns PDF or Excel reports through WhatsApp.

## Non-Goals for MVP

- WhatsApp Business Cloud API.
- Paid hosting or paid AI APIs.
- Google Sheets as the primary database.
- Multi-tenant billing.
- Mass messaging or broadcast automation.
- Complex natural-language understanding.
- Full web dashboard.

## Target Architecture

```text
Baileys WhatsApp transport
          |
          v
Internal message adapter
          |
          v
Command router and deterministic parser
          |
          +--> PostgreSQL repository
          |
          +--> Rule engine
          |
          +--> XLSX exporter using SheetJS
          |
          +--> PDF exporter using a local library
          |
          v
WhatsApp response sender
```

## Proposed Project Structure

```text
MYNOTE/
  src/
    app.ts
    config/
    transport/
      baileys-client.ts
      message-adapter.ts
      sender.ts
    application/
      process-incoming-message.ts
      create-record.ts
      generate-report.ts
    domain/
      parser/
      rules/
      reports/
      models/
    persistence/
      postgres.ts
      migrations/
      repositories/
    reporting/
      excel-exporter.ts
      pdf-exporter.ts
    mcp/
      server.ts
      tools/
  tests/
    parser/
    rules/
    persistence/
    reporting/
  data/
    .gitkeep
  reports/
    .gitkeep
  auth/
    .gitkeep
  .env.example
  .gitignore
  package.json
  tsconfig.json
```

## Phase 0: Project Setup

### Tasks

- Create the Node.js TypeScript project.
- Add Baileys, PostgreSQL driver, SheetJS, PDF library, validation library, and test runner.
- Add strict TypeScript settings.
- Add `.gitignore` for `auth`, `data`, `reports`, `.env`, and build output.
- Add `.env.example` with safe placeholder values.
- Add a basic logger that does not print message bodies by default.

### Acceptance Criteria

- The project installs without a paid service.
- TypeScript compiles.
- A test command runs successfully.
- Runtime and personal-data directories are ignored by Git.

## Phase 1: PostgreSQL Data Model

### Tables

`messages`

- `id`
- `source_message_id` unique
- `group_id`
- `group_name`
- `sender_id`
- `sender_name`
- `message_text`
- `received_at`
- `processing_status`
- `processing_error`

`records`

- `id`
- `message_id` unique
- `transaction_date`
- `type`
- `category`
- `description`
- `amount_minor`
- `currency`
- `created_at`

`categories`

- `id`
- `name` unique
- `type`
- `enabled`

`audit_log`

- `id`
- `action`
- `source_message_id`
- `status`
- `details`
- `created_at`

### Acceptance Criteria

- A message can be stored once.
- Reprocessing the same message ID does not create a second record.
- A failed parse remains diagnosable.
- Monetary values do not use floating-point storage.

## Phase 2: Baileys Connection

### Tasks

- Implement QR or pairing-code authentication.
- Store auth state only in the local auth directory.
- Reconnect after temporary network failures.
- Normalize incoming events into an internal message type.
- Detect group messages and extract group ID, sender, timestamp, and message ID.
- Ignore unauthorized group IDs.
- Implement safe text and document sending.

### Acceptance Criteria

- The bot can connect with a dedicated WhatsApp number.
- A message from an allowed group reaches the application service.
- A message from another group is ignored.
- Restarting the process does not require pairing every time.
- Duplicate message events are harmless.

## Phase 3: Deterministic Parser

### Supported Format

```text
#catat
tanggal: DD/MM/YYYY
jenis: pemasukan|pengeluaran
kategori: text
keterangan: text
nominal: positive number
```

### Tasks

- Parse command and key-value lines.
- Normalize Indonesian labels and whitespace.
- Parse Indonesian number formats such as `250000`, `250.000`, and `250.000,50`.
- Validate date, type, category, description, and amount.
- Return field-level errors.
- Add report-command parsing.

### Acceptance Criteria

- Valid messages produce a typed record.
- Invalid messages produce a correction response.
- Parser tests cover normal, incomplete, duplicated-field, and malformed inputs.
- The parser has no WhatsApp or database dependency.

## Phase 4: Rules and Confirmation

### Initial Rules

- Only configured groups can create records.
- Only configured commands can trigger processing.
- Categories must be enabled.
- Amount must be greater than zero.
- A record with all required fields can be stored immediately.
- Ambiguous or incomplete input must not be stored as completed.

### Optional Confirmation Flow

For future natural-language input:

```text
Saya memahami pesan sebagai:
Pengeluaran - Operasional - Rp250.000
Balas: YA <ID>
```

Do not implement AI fallback before the deterministic flow is stable.

## Phase 5: Excel Export

### Workbook Sheets

- `Ringkasan`
- `Transaksi`
- `Per Kategori`
- `Metadata`

### Tasks

- Filter records by date range and group.
- Write summary totals.
- Write transaction rows.
- Apply header styling, number formatting, and frozen headers.
- Use a safe generated filename.

### Acceptance Criteria

- Excel opens in LibreOffice and Microsoft Excel.
- Totals match PostgreSQL query results.
- Empty periods produce a valid report with zero totals.
- Raw message content is excluded by default.

## Phase 6: PDF Export

### Initial Report Layout

- Report title and period.
- Total income, total expense, balance, and transaction count.
- Category summary.
- Transaction detail table.
- Generated timestamp.

### Tasks

- Select a local PDF generation approach.
- Implement Indonesian date and currency formatting.
- Add page numbers and table overflow handling.
- Use the visual reference assets after their layout details are confirmed.

### Acceptance Criteria

- PDF opens without corruption.
- Long transaction lists continue across pages.
- Currency and totals are readable.
- The report does not include credentials or internal paths.

## Phase 7: WhatsApp Report Commands

### Commands

```text
#laporan hari ini
#laporan minggu ini
#laporan bulan ini
#laporan pdf bulan ini
#laporan excel bulan ini
```

### Tasks

- Parse date periods using `Asia/Jakarta`.
- Generate the requested file.
- Send a short progress response if generation takes time.
- Send the file only to the authorized group.
- Remove or retain old reports according to a local retention setting.

### Acceptance Criteria

- Each supported command produces the correct period.
- PDF and Excel can be delivered to WhatsApp.
- Invalid commands return usage guidance.
- Report failures return a useful error without exposing stack traces.

## Phase 8: MCP Server

### Tasks

- Implement stdio MCP server.
- Add read-only tools from `MCP.md`.
- Reuse application services.
- Bound query size and report ranges.
- Add structured error responses.
- Test that credentials are never returned.

### Acceptance Criteria

- An MCP client can list groups, validate messages, query summaries, and generate reports.
- MCP cannot access arbitrary filesystem paths.
- MCP cannot write records in the first release.

## Phase 9: Hardening and Backup

### Tasks

- Add graceful shutdown.
- Add reconnect and retry limits.
- Add PostgreSQL backup and restore instructions.
- Add report cleanup policy.
- Add health check command.
- Add structured audit logs.
- Document WhatsApp account risks and recovery steps.

### Acceptance Criteria

- The application recovers from a temporary connection loss.
- Database backup can be restored locally.
- Sensitive runtime data is not committed.
- The operator can diagnose connection, parsing, and report errors.

## Suggested Environment Variables

```text
NODE_ENV=development
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DATABASE=mynote
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_SSL=false
POSTGRES_POOL_MAX=10
AUTH_DIR=./auth/baileys
REPORTS_DIR=./reports
TIMEZONE=Asia/Jakarta
ALLOWED_GROUP_IDS=
DEFAULT_CURRENCY=IDR
LOG_MESSAGE_CONTENT=false
```

## Verification Matrix

| Area | Verification |
| --- | --- |
| Parser | Unit tests for valid and invalid formats |
| Idempotency | Same message ID processed twice |
| Authorization | Allowed and unauthorized group tests |
| Database | Migration and repository tests |
| Excel | Open generated file and verify totals |
| PDF | Open generated file and verify pagination |
| WhatsApp | Manual QR/pairing and group test |
| Reports | Daily, weekly, monthly, and empty periods |
| Security | Secret scan and ignored-file check |
| MCP | Tool input bounds and path-safety tests |

## Reusable Assets From This Workspace

The workspace contains existing projects and samples that can reduce implementation effort. Reuse must be selective. Copy only the smallest useful module or pattern, review its license, remove domain-specific behavior, and add MYNOTE tests. Do not merge complete applications into MYNOTE.

### Reuse Policy

- Prefer source files that solve one isolated problem.
- Keep Baileys as the MYNOTE WhatsApp transport decision.
- Do not copy credentials, session folders, `.env` files, generated reports, `node_modules`, debug logs, or personal data.
- Do not copy company-specific maritime pricing logic into the generic note domain.
- Treat all external API integrations as optional. The free core must work without them.
- Preserve license notices when code is reused.
- Record the source path and adaptation in the implementation commit or module documentation.

### Priority Matrix

| Source folder | Candidate asset | Reuse level | MYNOTE use |
| --- | --- | --- | --- |
| `botreader/automation/whatsapp_service.js` | Group filtering, command routing, user authorization, duplicate-event guard, document sending flow | Adapt pattern | Use the control-flow ideas, but replace `whatsapp-web.js` with Baileys and group-name checks with group IDs |
| `botreader/automation/whatsapp_client.js` | WhatsApp lifecycle events, QR status, incoming message handling, PDF/file reply | Reference only | Use for operational behavior; do not copy the browser client or AI/domain handlers |
| `botreader/automation/file_parser.js` | SheetJS workbook reading, worksheet iteration, header-aware row conversion | High | Adapt for importing `.xlsx` and validating report input |
| `botreader/automation/invoice_gen.js` | PDFKit file creation, output directory handling, stream completion | High | Adapt into the local PDF report exporter |
| `botreader/automation/invoice_template.js` | PDF pagination and table layout techniques | Medium | Reuse layout techniques only; create a new MYNOTE report template |
| `botreader/automation/db.js` | Table initialization style, settings, WhatsApp groups/users, audit log concepts | Reference only | Use as a schema design reference; do not copy the PostgreSQL schema wholesale |
| `botreader/automation/parser.js` | Validation-before-save flow and database conflict handling | Medium | Adapt the persist-after-parse pattern and idempotency behavior |
| `botreader/automation/clear_jobs.js` | Date-range command parsing and destructive-action response pattern | Low | Use only date parsing ideas; MYNOTE must not add destructive commands to MVP |
| `botreader/automation/groq.js` | Structured JSON extraction prompt pattern | Optional | Do not use in the free MVP; consider only for a future local-model adapter |
| `botreader/automation/companies/*` | Modular rules/parser organization | Reference only | Use the folder separation idea, not the tug, barge, horsepower, or surcharge rules |
| `botreader/docs/SYSTEM_DOCUMENTATION.md` | Workflow documentation format | Medium | Use as a documentation outline for MYNOTE operations and data flow |
| `botreader/docs/PROJECT_STRUCTURE_OVERVIEW.md` | Separation of backend, web, mobile, and docs | Low | Use as a structural reference if a MYNOTE dashboard is added later |
| `wppconnect/examples/basic/index.js` | Minimal incoming-message and outgoing-reply flow | Reference only | Use to compare event handling; do not run WPPConnect with Baileys on the same account |
| `wppconnect/examples/rest/index.js` | WhatsApp status endpoint and service lifecycle shape | Low | Use only if MYNOTE later exposes a local health endpoint |
| `wa-automate-nodejs` | Alternative WhatsApp Web API, webhook and session concepts | Reference only | Keep as a fallback research source; do not combine it with Baileys |
| `whatsapp` | Go WhatsApp/Matrix bridge | Not planned | It is a bridge product, not a direct MYNOTE transport; use only for protocol research |
| `python-samples/sheets/snippets/sheets_append_values.py` | Append rows to Google Sheets | Optional | Keep as a future adapter; Google Sheets is not part of the free local core |
| `python-samples/events/next18/spreadsheet_writer.py` | Spreadsheet creation, multiple tabs, batch writes, metadata | Optional | Use as a design reference for workbook tabs and batch operations |
| `python-samples/drive/snippets/drive-v3/file_snippet/export_pdf.py` | Google Drive export to PDF | Not planned for MVP | Cloud export conflicts with the local-only core; use only for an optional Google Workspace adapter |
| `sheetjs` | Spreadsheet processing library and examples | High | Use the existing SheetJS direction for local `.xlsx` generation and import |
| `n8n` | Visual workflow, webhook, integrations, AI workflow ideas | Optional later | Do not make MYNOTE dependent on n8n; consider it only for operator-configurable workflows |
| `node-red` | Event-driven low-code flow concepts | Optional later | Do not add it to the MVP; use only if a low-code integration layer becomes necessary |
| `automatisch` | Self-hosted automation platform | Not planned | Avoid a second workflow engine while MYNOTE core is being built |
| `airflow` | Scheduled and monitored batch workflows | Not planned for MVP | It is not a real-time WhatsApp transport; consider only for large scheduled archival jobs |
| `firefly-iii` | Financial categories, rules, reports, and transaction concepts | Reference only | Use for finance-domain inspiration if MYNOTE becomes a financial ledger; do not embed the application |
| `budibase` | Self-hosted admin app and operations UI | Optional later | Consider for a future admin panel, not for the first WhatsApp-to-report release |

### Concrete Extraction Tasks

The following tasks should be included in the relevant implementation phases:

1. During Phase 0, inspect `botreader/package.json` for the already-used `xlsx` and `pdfkit` dependency versions, then choose compatible MYNOTE versions instead of copying the whole manifest.
2. During Phase 2, implement a Baileys adapter using the lifecycle and group-authorization behavior from `botreader/automation/whatsapp_service.js` and `wppconnect/examples/basic/index.js` as references.
3. During Phase 2, implement persistent message idempotency. The in-memory `recentInboundMessageIds` pattern from BotReader is only a first-line optimization, not the source of truth.
4. During Phase 3, use the field-validation and persist-after-parse approach from `botreader/automation/parser.js`, but define MYNOTE fields instead of job and vessel fields.
5. During Phase 5, adapt the workbook reading approach from `botreader/automation/file_parser.js` and the SheetJS samples. Add MYNOTE-specific worksheets: `Ringkasan`, `Transaksi`, `Per Kategori`, and `Metadata`.
6. During Phase 6, adapt the PDFKit stream and pagination behavior from `botreader/automation/invoice_gen.js` and `invoice_template.js`. Do not reuse invoice labels, pricing fields, or maritime branding.
7. During Phase 9, use BotReader's audit and settings concepts to verify group configuration, user approval, command actions, and report generation events.
8. After MVP validation, evaluate whether the `n8n`, `node-red`, or `budibase` folders solve an actual operator need. Do not add them only because they already exist in the workspace.

### Assets Explicitly Excluded

The following must not enter the MYNOTE free core:

- `botreader/.env` and any credential or session files.
- Groq, Gemini, Firebase, email, and cloud-storage integrations unless separately approved as optional adapters.
- BotReader's maritime company parsers, pricing engine, invoice numbering, surcharge logic, and vessel database.
- WPPConnect, `whatsapp-web.js`, and `wa-automate` as simultaneous transports.
- `node_modules`, generated PDFs, debug logs, temporary scripts, and production data.
- Google Sheets and Google Drive as the primary persistence or report path.

## Implementation Order

1. Project setup and configuration.
2. PostgreSQL schema and repositories.
3. Pure deterministic parser.
4. Baileys connection and message adapter.
5. Record command end to end.
6. Excel exporter.
7. PDF exporter.
8. Report commands over WhatsApp.
9. MCP read-only server.
10. Hardening, backup, and documentation.

## Definition Of Done

The MVP is complete when a user can send a valid `#catat` message from an approved WhatsApp group, see it stored once in PostgreSQL, request a period report, and receive a valid PDF or Excel file without any paid service or cloud API.
