# WhatsApp Group Settings

## Date

2026-11-07

## Objective

Allow the operator to choose authorized WhatsApp groups by name from the web instead of manually entering Group IDs.

## Implementation

- Added a `SETTING` button beside the connected WhatsApp button.
- Added a group picker popup that loads group names from the connected Baileys session.
- Added endpoints for available WhatsApp groups and configured allowed groups.
- Persisted selected groups in PostgreSQL `allowed_groups`.
- Updated message authorization to check the database-backed allowed groups.

The UI uses group names for selection, but the database stores the immutable WhatsApp Group ID as the key. This avoids problems when a group name changes or multiple groups have the same name.

## Verification

```text
npm test
npm run build
npm run lint
```

All checks pass. Live group listing requires an active WhatsApp session.

## Known Limitations

- The group picker only lists groups visible to the connected WhatsApp account.
- Duplicate group names are displayed as returned by WhatsApp; the Group ID remains the internal identity.
