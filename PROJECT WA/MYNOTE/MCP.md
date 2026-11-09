# MYNOTE MCP Design

## Purpose

This document defines the Model Context Protocol (MCP) surface for MYNOTE. MCP is optional. The core application must work without an AI model, an MCP client, or an external API.

MCP should expose safe, read-oriented tools for administration, inspection, and report generation. It must not bypass the normal application services.

## Deployment Model

The MCP server runs as a local process next to the MYNOTE application:

```text
MCP client
    |
    | stdio
    v
MYNOTE MCP server
    |
    +-- application services
    +-- PostgreSQL repository
    +-- report exporters
```

Use stdio transport for the first version. It avoids opening a network port and does not require a hosted MCP service.

## MCP Tools

### `mynote_list_groups`

Lists configured WhatsApp groups that the system is allowed to process.

Input:

```json
{}
```

Output fields:

- `groupId`
- `groupName`
- `enabled`

### `mynote_validate_message`

Parses a message without storing it. This is useful for testing rules.

Input:

```json
{
  "text": "#catat\ntanggal: 04/11/2026\njenis: pengeluaran\nkategori: operasional\nketerangan: ATK\nnominal: 250000"
}
```

Output fields:

- `recognizedCommand`
- `valid`
- `record`
- `errors`
- `warnings`

### `mynote_list_records`

Returns stored records using bounded filters.

Input fields:

- `from`
- `to`
- `type`
- `category`
- `groupId`
- `limit`

The server must enforce a maximum `limit` and must not return raw credentials.

### `mynote_get_summary`

Returns totals for a selected period.

Output fields:

- `from`
- `to`
- `incomeTotal`
- `expenseTotal`
- `balance`
- `transactionCount`
- `byCategory`

### `mynote_generate_report`

Creates a local report file.

Input fields:

- `format`: `pdf` or `xlsx`
- `from`
- `to`
- `groupId`
- `includeRawMessage`: must default to `false`

Output fields:

- `format`
- `fileName`
- `filePath`
- `recordCount`
- `createdAt`

The server must write files only inside the configured reports directory. It must reject path traversal and arbitrary output paths.

### `mynote_health_check`

Returns local service health without exposing secrets.

Output fields:

- `database`
- `databaseName`
- `whatsappConnectionState`
- `lastMessageAt`
- `reportsDirectory`

## MCP Resources

The initial implementation may expose these read-only resources:

- `mynote://config/rules`
- `mynote://config/categories`
- `mynote://reports/recent`
- `mynote://health`

Do not expose the Baileys auth directory as an MCP resource.

## Safety Requirements

- MCP tools must call application services, not SQL directly from tool handlers.
- Report tools must use the same authorization checks as WhatsApp commands.
- Never expose session files, environment variables, access tokens, or full phone numbers.
- Keep write operations out of the first MCP release.
- If write tools are added later, require explicit confirmation and an audit record.
- Return structured errors instead of stack traces.
- Bound every query and report range.

## Suggested MCP Configuration

The final MCP client configuration should point to a built local server, for example:

```json
{
  "mcpServers": {
    "mynote": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "cwd": "D:/Project/autonote/PROJECT WA/MYNOTE"
    }
  }
}
```

Do not place secrets in this configuration. Use a local `.env` file that is excluded from Git.
