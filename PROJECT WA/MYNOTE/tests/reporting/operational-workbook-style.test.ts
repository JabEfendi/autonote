import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { exportOperationalWorkbook } from '../../src/reporting/operational-workbook.js';
import type { DailyCashReport } from '../../src/domain/ledger-models.js';

describe('operational workbook styling', () => {
  it('writes colored headers, borders, and number formats', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mynote-style-'));
    const report: DailyCashReport = {
      reportName: 'Test', companyName: 'Test', totalUnits: 1, from: '2026-11-01', to: '2026-11-01', openingBalance: 0,
      totalIncome: 1000000, totalExpense: 0, closingBalance: 1000000,
      rows: [{ id: 1, transactionDate: '2026-11-01', description: 'Test', transactionType: 'income', category: 'SHIPMENT_PAYMENT', incomeAmount: 1000000, expenseAmount: 0, balance: 1000000, status: 'posted', createdAt: '2026-11-01T00:00:00.000Z' }]
    };
    try {
      const filePath = await exportOperationalWorkbook(dir, report);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.getWorksheet('Kas Harian')!;
      const header = sheet.getCell(1, 1);
      expect(header.fill?.fgColor?.argb).toBe('FF0D5C5E');
      expect(header.border?.top?.style).toBe('thin');
      expect(header.font?.bold).toBe(true);
      expect(sheet.getCell(5, 4).numFmt).toBe('#,##0');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
