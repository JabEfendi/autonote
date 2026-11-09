import { Pool, type PoolConfig } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ParsedRecord, StoredRecord } from '../domain/models.js';
import type { DailyCashReport, DailyCashRow, LedgerTransactionDraft, LedgerTransactionRecord, LedgerTransactionUpdate } from '../domain/ledger-models.js';

export type Group = { groupId: string; groupName: string; enabled: boolean };
export type CommandFormat = { id: number; name: string; command: string; targetCommand: string; description: string; template: string; enabled: boolean; builtIn: boolean };
export type Summary = { from: string; to: string; incomeTotal: number; expenseTotal: number; balance: number; transactionCount: number; byCategory: Array<{ category: string; amount: number }> };
export type DashboardData = { summary: Summary; records: StoredRecord[]; database: string; lastMessageAt: string | null };
export type ReportProfile = { name: string; companyName: string; reportName: string; totalUnits: number; openingBalance: number };

export class PostgresRepository {
  readonly pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async initialize(): Promise<void> {
    await this.pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const migrationDir = path.join(process.cwd(), 'src', 'persistence', 'migrations');
    const files = readdirSync(migrationDir).filter((file: string) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of files) {
      const alreadyApplied = await this.pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (alreadyApplied.rowCount) continue;
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(readFileSync(path.join(migrationDir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    await this.pool.query(`INSERT INTO command_formats (name, command, target_command, description, template, enabled, built_in) VALUES
      ('Catat transaksi', '#catat', '#catat', 'Menyimpan pemasukan atau pengeluaran baru', '#catat\\ntanggal: DD/MM/YYYY\\njenis: pemasukan|pengeluaran\\nkategori: text\\nketerangan: text\\nnominal: 250000', TRUE, TRUE),
      ('Laporan periode', '#laporan', '#laporan', 'Membuat laporan PDF atau Excel berdasarkan periode', '#laporan [pdf|excel] hari ini|minggu ini|bulan ini', TRUE, TRUE)
      ON CONFLICT (command) DO NOTHING`);
  }

  async listGroups(): Promise<Group[]> {
    const result = await this.pool.query('SELECT group_id AS "groupId", group_name AS "groupName", enabled FROM allowed_groups ORDER BY group_name');
    return result.rows;
  }

  async setAllowedGroups(groups: Array<{ groupId: string; groupName: string }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE allowed_groups SET enabled = FALSE');
      for (const group of groups) {
        await client.query(`INSERT INTO allowed_groups (group_id, group_name, enabled) VALUES ($1, $2, TRUE) ON CONFLICT (group_id) DO UPDATE SET group_name = EXCLUDED.group_name, enabled = TRUE`, [group.groupId, group.groupName]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async isAllowedGroup(groupId: string, configuredGroupIds: string[] = []): Promise<boolean> {
    if (configuredGroupIds.includes(groupId)) return true;
    const result = await this.pool.query('SELECT 1 FROM allowed_groups WHERE group_id = $1 AND enabled = TRUE LIMIT 1', [groupId]);
    return (result.rowCount || 0) > 0;
  }

  async listCommandFormats(): Promise<CommandFormat[]> {
    const result = await this.pool.query('SELECT id, name, command, target_command AS "targetCommand", description, template, enabled, built_in AS "builtIn" FROM command_formats WHERE enabled = TRUE ORDER BY built_in DESC, name');
    return result.rows.map((row) => ({ ...row, id: Number(row.id) }));
  }

  async addCommandFormat(input: { name: string; command: string; targetCommand: string; description: string; template: string }): Promise<CommandFormat> {
    const result = await this.pool.query('INSERT INTO command_formats (name, command, target_command, description, template, enabled, built_in) VALUES ($1, $2, $3, $4, $5, TRUE, FALSE) RETURNING id, name, command, target_command AS "targetCommand", description, template, enabled, built_in AS "builtIn"', [input.name, input.command, input.targetCommand, input.description, input.template]);
    return { ...result.rows[0], id: Number(result.rows[0].id) };
  }

  async saveLedgerTransaction(transaction: LedgerTransactionDraft): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`INSERT INTO daily_cash_transactions (transaction_date, description, transaction_type, category, subcategory, income_amount, expense_amount, vehicle_plate, quantity, unit, route_origin, route_destination, counterparty, installment_number, settlement_kind, borongan_amount, source_message_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'posted') ON CONFLICT (source_message_id) DO NOTHING RETURNING id`, [transaction.transactionDate, transaction.description, transaction.transactionType, transaction.category, transaction.subcategory || null, transaction.incomeAmount, transaction.expenseAmount, transaction.vehiclePlate || null, transaction.quantity || null, transaction.unit || null, transaction.routeOrigin || null, transaction.routeDestination || null, transaction.counterparty || null, transaction.installmentNumber || null, transaction.settlementKind || null, transaction.boronganAmount || 0, transaction.sourceMessageId || null]);
      if (!result.rows[0]) { await client.query('ROLLBACK'); return 0; }
      const id = Number(result.rows[0].id);
      await client.query('INSERT INTO audit_log (action, source_message_id, status, details, created_at) VALUES ($1,$2,$3,$4,NOW())', ['create', transaction.sourceMessageId || null, 'success', JSON.stringify({ transactionId: id, status: 'posted' })]);
      await client.query('COMMIT');
      return id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async updateLedgerTransaction(id: number, update: LedgerTransactionUpdate): Promise<boolean> {
    if (update.incomeAmount !== undefined && update.incomeAmount < 0) throw new Error('incomeAmount tidak boleh negatif');
    if (update.expenseAmount !== undefined && update.expenseAmount < 0) throw new Error('expenseAmount tidak boleh negatif');
    const fields: Array<[string, unknown]> = Object.entries({
      transaction_date: update.transactionDate, description: update.description, transaction_type: update.transactionType,
      category: update.category, subcategory: update.subcategory, income_amount: update.incomeAmount, expense_amount: update.expenseAmount,
      vehicle_plate: update.vehiclePlate, quantity: update.quantity, unit: update.unit, route_origin: update.routeOrigin,
      route_destination: update.routeDestination, counterparty: update.counterparty, installment_number: update.installmentNumber,
      settlement_kind: update.settlementKind, borongan_amount: update.boronganAmount
    }).filter(([, value]) => value !== undefined);
    if (!fields.length) return false;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const set = fields.map(([field], index) => `${field} = $${index + 2}`).join(', ');
      const result = await client.query(`UPDATE daily_cash_transactions SET ${set}, updated_at = NOW() WHERE id = $1 AND status <> 'cancelled'`, [id, ...fields.map(([, value]) => value)]);
      if (!result.rowCount) { await client.query('ROLLBACK'); return false; }
      await client.query('INSERT INTO audit_log (action, status, details, created_at) VALUES ($1,$2,$3,NOW())', ['update', 'success', JSON.stringify({ transactionId: id, fields: fields.map(([field]) => field) })]);
      await client.query('COMMIT');
      return true;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async cancelLedgerTransaction(id: number, reason: string): Promise<boolean> {
    return this.transitionLedgerStatus(id, 'cancelled', reason, 'cancel');
  }

  async restoreLedgerTransaction(id: number): Promise<boolean> {
    return this.transitionLedgerStatus(id, 'posted', null, 'restore');
  }

  private async transitionLedgerStatus(id: number, status: 'posted' | 'cancelled', reason: string | null, action: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = status === 'cancelled'
        ? await client.query(`UPDATE daily_cash_transactions SET status = 'cancelled', cancel_reason = $2, cancelled_at = NOW(), updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'posted')`, [id, reason])
        : await client.query(`UPDATE daily_cash_transactions SET status = 'posted', cancel_reason = NULL, cancelled_at = NULL, updated_at = NOW() WHERE id = $1 AND status = 'cancelled'`, [id]);
      if (!result.rowCount) { await client.query('ROLLBACK'); return false; }
      await client.query('INSERT INTO audit_log (action, status, details, created_at) VALUES ($1,$2,$3,NOW())', [action, 'success', JSON.stringify({ transactionId: id, reason })]);
      await client.query('COMMIT');
      return true;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async getDailyCashReport(from: string, to: string, openingBalance?: number): Promise<DailyCashReport> {
    const profile = await this.getReportProfile();
    const opening = openingBalance !== undefined ? openingBalance : profile.openingBalance;
    const result = await this.pool.query(`SELECT id, transaction_date::text AS "transactionDate", description, transaction_type AS "transactionType", category, subcategory, income_amount::numeric AS "incomeAmount", expense_amount::numeric AS "expenseAmount", vehicle_plate AS "vehiclePlate", quantity, unit, route_origin AS "routeOrigin", route_destination AS "routeDestination", counterparty, reference_number AS "referenceNumber", installment_number AS "installmentNumber", settlement_kind AS "settlementKind", borongan_amount::numeric AS "boronganAmount", status, created_at AS "createdAt" FROM daily_cash_transactions WHERE transaction_date BETWEEN $1::date AND $2::date AND status = 'posted' ORDER BY transaction_date, created_at, id`, [from, to]);
    let balance = Number(opening);
    const rows: DailyCashRow[] = result.rows.map((row) => { balance += Number(row.incomeAmount) - Number(row.expenseAmount); return { ...row, id: Number(row.id), incomeAmount: Number(row.incomeAmount), expenseAmount: Number(row.expenseAmount), boronganAmount: row.boronganAmount === null ? undefined : Number(row.boronganAmount), balance, createdAt: new Date(row.createdAt).toISOString() }; });
    const totalIncome = rows.reduce((sum, row) => sum + row.incomeAmount, 0);
    const totalExpense = rows.reduce((sum, row) => sum + row.expenseAmount, 0);
    await this.pool.query('INSERT INTO audit_log (action, status, details, created_at) VALUES ($1,$2,$3,NOW())', ['report_generation', 'success', JSON.stringify({ report: 'daily_cash', from, to })]);
    return { reportName: profile.reportName, companyName: profile.companyName, totalUnits: profile.totalUnits, from, to, openingBalance: opening, totalIncome, totalExpense, closingBalance: balance, rows };
  }

  async getReportProfile(): Promise<ReportProfile> {
    const result = await this.pool.query(`SELECT name, company_name AS "companyName", report_name AS "reportName", total_units AS "totalUnits", opening_balance::numeric AS "openingBalance" FROM report_profiles WHERE name = 'default'`);
    const row = result.rows[0];
    return { name: row.name, companyName: row.companyName, reportName: row.reportName, totalUnits: Number(row.totalUnits), openingBalance: Number(row.openingBalance) };
  }

  async saveReportProfile(input: { companyName: string; reportName: string; totalUnits: number; openingBalance: number }): Promise<ReportProfile> {
    const result = await this.pool.query(`INSERT INTO report_profiles (name, company_name, report_name, total_units, opening_balance, updated_at) VALUES ('default', $1, $2, $3, $4, NOW()) ON CONFLICT (name) DO UPDATE SET company_name = EXCLUDED.company_name, report_name = EXCLUDED.report_name, total_units = EXCLUDED.total_units, opening_balance = EXCLUDED.opening_balance, updated_at = NOW() RETURNING name, company_name AS "companyName", report_name AS "reportName", total_units AS "totalUnits", opening_balance::numeric AS "openingBalance"`, [input.companyName, input.reportName, input.totalUnits, input.openingBalance]);
    const row = result.rows[0];
    return { name: row.name, companyName: row.companyName, reportName: row.reportName, totalUnits: Number(row.totalUnits), openingBalance: Number(row.openingBalance) };
  }

  async listLedgerTransactions(from?: string, to?: string): Promise<LedgerTransactionRecord[]> {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (from) { values.push(from); conditions.push(`transaction_date >= $${values.length}`); }
    if (to) { values.push(to); conditions.push(`transaction_date <= $${values.length}`); }
    const result = await this.pool.query(`SELECT id, transaction_date::text AS "transactionDate", description, transaction_type AS "transactionType", category, subcategory, income_amount::numeric AS "incomeAmount", expense_amount::numeric AS "expenseAmount", vehicle_plate AS "vehiclePlate", quantity, unit, route_origin AS "routeOrigin", route_destination AS "routeDestination", counterparty, reference_number AS "referenceNumber", installment_number AS "installmentNumber", settlement_kind AS "settlementKind", borongan_amount::numeric AS "boronganAmount", status, cancel_reason AS "cancelReason", created_at AS "createdAt", updated_at AS "updatedAt" FROM daily_cash_transactions ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY transaction_date, created_at, id`, values);
    return result.rows.map((row) => ({ ...row, id: Number(row.id), cancelReason: row.cancelReason, incomeAmount: Number(row.incomeAmount), expenseAmount: Number(row.expenseAmount), boronganAmount: row.boronganAmount === null ? undefined : Number(row.boronganAmount), quantity: row.quantity === null ? undefined : Number(row.quantity), installmentNumber: row.installmentNumber === null ? undefined : Number(row.installmentNumber), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() }));
  }

  async listAuditLog(limit = 50): Promise<Array<{ id: number; action: string; status: string; details: string | null; createdAt: string }>> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const result = await this.pool.query('SELECT id, action, status, details, created_at AS "createdAt" FROM audit_log ORDER BY id DESC LIMIT $1', [safeLimit]);
    return result.rows.map((row) => ({ ...row, id: Number(row.id), createdAt: new Date(row.createdAt).toISOString() }));
  }

  async listRecords(filters: { from?: string; to?: string; type?: string; category?: string; groupId?: string; limit?: number }): Promise<StoredRecord[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
    if (filters.from) add('r.transaction_date >= ?::date', filters.from);
    if (filters.to) add('r.transaction_date <= ?::date', filters.to);
    if (filters.type) add('r.type = ?', filters.type);
    if (filters.category) add('r.category = ?', filters.category);
    if (filters.groupId) add('m.group_id = ?', filters.groupId);
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    values.push(limit);
    const result = await this.pool.query(`SELECT r.id, m.source_message_id AS "messageId", m.group_id AS "groupId", r.transaction_date::text AS "transactionDate", r.type, r.category, r.description, r.amount_minor::text AS "amountMinor", r.currency, r.created_at AS "createdAt" FROM records r JOIN messages m ON m.id = r.message_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.transaction_date, r.id LIMIT $${values.length}`, values);
    return result.rows.map((row) => ({ ...row, id: Number(row.id), amountMinor: Number(row.amountMinor) }));
  }

  async getSummary(from: string, to: string, groupId?: string): Promise<Summary> {
    const records = await this.listRecords({ from, to, groupId, limit: 500 });
    const incomeTotal = records.filter((record) => record.type === 'pemasukan').reduce((sum, record) => sum + record.amountMinor, 0);
    const expenseTotal = records.filter((record) => record.type === 'pengeluaran').reduce((sum, record) => sum + record.amountMinor, 0);
    const categories = new Map<string, number>();
    for (const record of records) categories.set(record.category, (categories.get(record.category) || 0) + record.amountMinor);
    return { from, to, incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal, transactionCount: records.length, byCategory: [...categories].map(([category, amount]) => ({ category, amount })) };
  }

  async saveMessage(input: { sourceMessageId: string; groupId: string; groupName: string; senderId: string; senderName: string; text: string; receivedAt: string }, record?: ParsedRecord, error?: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const message = await client.query(`INSERT INTO messages (source_message_id, group_id, group_name, sender_id, sender_name, message_text, received_at, processing_status, processing_error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (source_message_id) DO NOTHING RETURNING id`, [input.sourceMessageId, input.groupId, input.groupName, input.senderId, input.senderName, input.text, input.receivedAt, record ? 'processed' : error ? 'failed' : 'ignored', error ?? null]);
      if (!message.rowCount) { await client.query('ROLLBACK'); return false; }
      if (record) await client.query('INSERT INTO records (message_id, transaction_date, type, category, description, amount_minor, currency, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [message.rows[0].id, record.transactionDate, record.type, record.category, record.description, record.amountMinor, record.currency, new Date().toISOString()]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async health(): Promise<{ database: string; databaseName: string; lastMessageAt: string | null }> {
    const result = await this.pool.query('SELECT MAX(received_at) AS "lastMessageAt" FROM messages');
    return { database: 'ok', databaseName: this.pool.options.database || 'configured', lastMessageAt: result.rows[0]?.lastMessageAt ?? null };
  }

  async getDashboardData(from: string, to: string): Promise<DashboardData> {
    const [summary, records, health] = await Promise.all([
      this.getSummary(from, to),
      this.listRecords({ from, to, limit: 12 }),
      this.health()
    ]);
    return { summary, records, database: health.database, lastMessageAt: health.lastMessageAt };
  }

  async close(): Promise<void> { await this.pool.end(); }
}
