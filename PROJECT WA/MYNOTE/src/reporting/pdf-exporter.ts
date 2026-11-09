import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { StoredRecord } from '../domain/models.js';
import type { Summary } from '../persistence/postgres.js';

export async function exportPdf(reportsDir: string, records: StoredRecord[], summary: Summary): Promise<string> {
  fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, `mynote-${summary.from}-${summary.to}.pdf`);
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 }); const stream = fs.createWriteStream(filePath); stream.on('finish', resolve).on('error', reject); doc.pipe(stream as never);
    doc.fontSize(18).text('Laporan MYNOTE'); doc.fontSize(10).text(`Periode: ${summary.from} sampai ${summary.to}`).moveDown();
    doc.text(`Total pemasukan: ${summary.incomeTotal} ${records[0]?.currency || ''}`); doc.text(`Total pengeluaran: ${summary.expenseTotal} ${records[0]?.currency || ''}`); doc.text(`Saldo: ${summary.balance} ${records[0]?.currency || ''}`); doc.text(`Jumlah transaksi: ${summary.transactionCount}`).moveDown();
    doc.fontSize(12).text('Transaksi').moveDown(0.5); doc.fontSize(9);
    for (const record of records) { if (doc.y > 730) doc.addPage(); doc.text(`${record.transactionDate} | ${record.type} | ${record.category} | ${record.description} | ${record.amountMinor} ${record.currency}`); }
    doc.moveDown().text(`Dibuat: ${new Date().toISOString()}`); doc.end();
  });
  return filePath;
}
