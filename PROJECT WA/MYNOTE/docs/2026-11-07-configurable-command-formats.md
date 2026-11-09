# Configurable Command Formats

## Date

2026-11-07

## Objective

Add a Format Perintah container below Data Source so supported command formats are visible and new command aliases can be added without editing source code.

## Implementation

- Added the PostgreSQL `command_formats` table with built-in commands for `#catat` and `#laporan`.
- Added safe schema upgrade for existing databases with `target_command`.
- Added `GET /api/command-formats` and `POST /api/command-formats`.
- Added the Format Perintah UI container and add-command modal below Data Source.
- Added command alias normalization in application validation. A configured alias is mapped to its supported internal command before deterministic parsing.

Example: an alias `#kas` targeting `#catat` can use the same structured record fields while presenting a more specific command to users.

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

- New formats currently target only existing parser commands (`#catat` or `#laporan`); adding a new business behavior still requires application code.
- The report parser does not yet normalize custom report aliases because report command parsing is handled separately from record validation.

## Next PRs / Follow-up Tasks

1. Add configurable report-period aliases with validation rules.
2. Add edit/disable/delete controls for non-built-in formats.
3. Add command format integration tests against PostgreSQL.
