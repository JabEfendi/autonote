import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { exportOperationalWorkbook } from '../../src/reporting/operational-workbook.js';
import type { DailyCashReport, DailyCashRow } from '../../src/domain/ledger-models.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function row(input: Partial<DailyCashRow> & { id: number }): DailyCashRow {
  return {
    transactionDate: '2026-11-01',
    description: '',
    transactionType: 'income',
    category: 'SHIPMENT_PAYMENT',
    incomeAmount: 0,
    expenseAmount: 0,
    balance: 0,
    status: 'posted',
    createdAt: '2026-11-01T08:00:00.000Z',
    ...input
  };
}

describe('operational workbook', () => {
  it('derives vehicle contract, borongan, setoran, and collection from structured fields', async () => {
    const report: DailyCashReport = {
      reportName: 'Laporan Keuangan Garasi Lampung',
      companyName: 'PT. Abdi Tasumu Indo',
      totalUnits: 10,
      from: '2026-11-01',
      to: '2026-11-08',
      openingBalance: 0,
      totalIncome: 6500000,
      totalExpense: 0,
      closingBalance: 6500000,
      rows: [
        row({ id: 1, description: 'Muat Jakarta - Palembang', incomeAmount: 6000000, settlementKind: 'contract', boronganAmount: 4500000, vehiclePlate: 'BH 8520 AO' }),
        row({ id: 2, description: 'Tagihan muat Jakarta - Palembang', incomeAmount: 500000, settlementKind: 'collection', vehiclePlate: 'BH 8520 AO' })
      ]
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mynote-workbook-'));
    tempDirs.push(dir);
    const filePath = await exportOperationalWorkbook(dir, report);
    const workbook = XLSX.readFile(filePath);
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets['BH 8520 AO'], { header: 1, defval: '' }) as unknown[][];
    expect(sheet).toContainEqual(['TGL', 'KETERANGAN', 'KONTRAK', 'BORONGAN', 'SETORAN', 'SETORAN MASUK', 'SETORAN GANTUNG', 'SPAREPART']);
    const total = sheet.find((line) => line[1] === 'TOTAL');
    expect(total).toEqual(['', 'TOTAL', 6000000, 4500000, 1500000, 500000, 1000000, 0]);
  });
});
