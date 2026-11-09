import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import type { StoredRecord } from '../domain/models.js';
import type { Summary } from '../persistence/postgres.js';

export function exportExcel(reportsDir: string, records: StoredRecord[], summary: Summary): string {
  fs.mkdirSync(reportsDir, { recursive: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Laporan MYNOTE'], ['Periode', summary.from, summary.to], ['Total pemasukan', summary.incomeTotal], ['Total pengeluaran', summary.expenseTotal], ['Saldo', summary.balance], ['Jumlah transaksi', summary.transactionCount]]), 'Ringkasan');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records.map(({ messageId: _messageId, groupId: _groupId, ...record }) => record)), 'Transaksi');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary.byCategory), 'Per Kategori');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Dibuat', new Date().toISOString()], ['Raw message', 'Tidak disertakan']]), 'Metadata');
  const filename = `mynote-${summary.from}-${summary.to}.xlsx`;
  const filePath = path.join(reportsDir, filename);
  XLSX.writeFile(workbook, filePath);
  return filePath;
}
