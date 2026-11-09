import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresRepository } from '../../src/persistence/postgres.js';
import type { LedgerTransactionDraft } from '../../src/domain/ledger-models.js';

const connectionString = process.env.POSTGRES_TEST_URL;

describe.skipIf(!connectionString)('PostgreSQL repository integration', () => {
  it('deduplicates, computes running balance, and cancels transactions with audit', async () => {
    const repository = new PostgresRepository({ connectionString: connectionString!, connectionTimeoutMillis: 5000 });
    await repository.initialize();
    try {
      const suffix = randomUUID().slice(0, 8);
      const income: LedgerTransactionDraft = { transactionDate: '2026-11-08', description: 'integration income', transactionType: 'income', category: 'SHIPMENT_PAYMENT', incomeAmount: 100000, expenseAmount: 0, settlementKind: 'contract', sourceMessageId: `test:income:${suffix}` };
      const expense: LedgerTransactionDraft = { transactionDate: '2026-11-08', description: 'integration expense', transactionType: 'expense', category: 'OPERATIONAL', incomeAmount: 0, expenseAmount: 30000, sourceMessageId: `test:expense:${suffix}` };

      const first = await repository.saveLedgerTransaction(income);
      const duplicate = await repository.saveLedgerTransaction(income);
      const expenseId = await repository.saveLedgerTransaction(expense);
      expect(first).toBeGreaterThan(0);
      expect(duplicate).toBe(0);
      expect(expenseId).toBeGreaterThan(0);

      const report = await repository.getDailyCashReport('2026-11-08', '2026-11-08', 50000);
      expect(report.rows).toHaveLength(2);
      expect(report.closingBalance).toBe(120000);

      expect(await repository.cancelLedgerTransaction(expenseId, 'integration cleanup')).toBe(true);
      const afterCancel = await repository.getDailyCashReport('2026-11-08', '2026-11-08', 50000);
      expect(afterCancel.rows).toHaveLength(1);
      expect(afterCancel.closingBalance).toBe(150000);

      expect(await repository.restoreLedgerTransaction(expenseId)).toBe(true);
      const audit = await repository.listAuditLog(50);
      expect(audit.some((entry) => entry.action === 'create')).toBe(true);
      expect(audit.some((entry) => entry.action === 'cancel')).toBe(true);
      expect(audit.some((entry) => entry.action === 'restore')).toBe(true);
      expect(audit.some((entry) => entry.action === 'report_generation')).toBe(true);
    } finally {
      await repository.close();
    }
  });

  it('keeps only one row for concurrent duplicate inserts', async () => {
    const repository = new PostgresRepository({ connectionString: connectionString!, connectionTimeoutMillis: 5000 });
    await repository.initialize();
    try {
      const suffix = randomUUID().slice(0, 8);
      const draft: LedgerTransactionDraft = { transactionDate: '2026-11-08', description: 'concurrent duplicate', transactionType: 'income', category: 'SHIPMENT_PAYMENT', incomeAmount: 250000, expenseAmount: 0, settlementKind: 'contract', sourceMessageId: `test:concurrent:${suffix}` };
      const results = await Promise.all([repository.saveLedgerTransaction(draft), repository.saveLedgerTransaction(draft)]);
      expect(results.filter((id) => id > 0)).toHaveLength(1);
      const report = await repository.getDailyCashReport('2026-11-08', '2026-11-08', 0);
      const rows = report.rows.filter((row) => row.description === 'concurrent duplicate');
      expect(rows).toHaveLength(1);
    } finally {
      await repository.close();
    }
  });
});
