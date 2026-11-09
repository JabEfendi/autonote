import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { DailyCashReport, DailyCashRow } from '../domain/ledger-models.js';

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

const CASH_COLUMNS = [
  { label: 'NO', x: MARGIN, width: 26, align: 'left' as const },
  { label: 'TANGGAL', x: MARGIN + 26, width: 58, align: 'left' as const },
  { label: 'KETERANGAN', x: MARGIN + 84, width: 196, align: 'left' as const },
  { label: 'PEMASUKAN', x: MARGIN + 280, width: 78, align: 'right' as const },
  { label: 'PENGELUARAN', x: MARGIN + 358, width: 84, align: 'right' as const },
  { label: 'SALDO AKHIR', x: MARGIN + 442, width: USABLE_WIDTH - 402, align: 'right' as const }
];

function money(value: number): string { return value ? idr.format(value) : '-'; }

function drawCell(doc: PDFKit.PDFDocument, text: string, x: number, width: number, y: number, options: { align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number } = {}): number {
  doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.size || 8);
  doc.text(text, x + 3, y + 4, { width: width - 6, align: options.align || 'left', height: 12, ellipsis: true, lineBreak: false });
  return y;
}

function drawDivider(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + USABLE_WIDTH, y).lineWidth(0.5).strokeColor('#d8e0dc').stroke();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0d5c5e').text(title);
  doc.y += 2;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > PAGE_HEIGHT - MARGIN) doc.addPage();
}

export async function exportLedgerPdf(reportsDir: string, report: DailyCashReport): Promise<string> {
  fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, `garasi-${report.from}-${report.to}.pdf`);
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', resolve).on('error', reject);
    doc.pipe(stream as never);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0d5c5e').text('LAPORAN KEUANGAN GARASI LAMPUNG', { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#55706d').text(`${report.companyName} - ${report.reportName}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).fillColor('#55706d').text(`Periode ${report.from} s.d. ${report.to} - Dibuat ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
    doc.moveDown(0.8);

    const boxY = doc.y;
    const boxWidth = (USABLE_WIDTH - 3 * 12) / 4;
    const boxes = [
      { label: 'SALDO AWAL', value: idr.format(report.openingBalance), tone: '#0d5c5e' },
      { label: 'PEMASUKAN', value: idr.format(report.totalIncome), tone: '#37815d' },
      { label: 'PENGELUARAN', value: idr.format(report.totalExpense), tone: '#bd6339' },
      { label: 'SALDO AKHIR', value: idr.format(report.closingBalance), tone: '#0d5c5e' }
    ];
    boxes.forEach((box, index) => {
      const x = MARGIN + index * (boxWidth + 12);
      doc.roundedRect(x, boxY, boxWidth, 52, 4).fillAndStroke('#f4f8f5', '#d8e0dc');
      doc.fillColor('#55706d').font('Helvetica').fontSize(7.5).text(box.label, x + 10, boxY + 9, { width: boxWidth - 20, align: 'left' });
      doc.fillColor(box.tone).font('Helvetica-Bold').fontSize(12).text(box.value, x + 10, boxY + 26, { width: boxWidth - 20, align: 'left', ellipsis: true });
    });
    doc.y = boxY + 52;
    doc.moveDown(1.2);

    drawSectionTitle(doc, 'Kas Harian');
    ensureSpace(doc, 60);
    const headerY = doc.y;
    for (const column of CASH_COLUMNS) drawCell(doc, column.label, column.x, column.width, headerY, { bold: true });
    doc.y = headerY + 18;
    drawDivider(doc, doc.y);

    let printed = 0;

    for (const row of report.rows) {
      ensureSpace(doc, 16);
      printed += 1;
      const y = doc.y;
      const cells = [
        String(printed), row.transactionDate, row.description, row.incomeAmount ? idr.format(row.incomeAmount) : '-', row.expenseAmount ? idr.format(row.expenseAmount) : '-', idr.format(row.balance)
      ];
      CASH_COLUMNS.forEach((column, index) => drawCell(doc, cells[index], column.x, column.width, y, { align: column.align }));
      doc.y = y + 15;
      drawDivider(doc, doc.y);
    }
    ensureSpace(doc, 18);
    const totalY = doc.y;
    drawCell(doc, '', MARGIN, 26, totalY);
    drawCell(doc, '', MARGIN + 26, 58, totalY);
    drawCell(doc, 'TOTAL', MARGIN + 84, 196, totalY, { bold: true });
    drawCell(doc, idr.format(report.totalIncome), MARGIN + 280, 78, totalY, { align: 'right', bold: true });
    drawCell(doc, idr.format(report.totalExpense), MARGIN + 358, 84, totalY, { align: 'right', bold: true });
    drawCell(doc, idr.format(report.closingBalance), MARGIN + 442, USABLE_WIDTH - 402, totalY, { align: 'right', bold: true });
    doc.y = totalY + 16;
    drawDivider(doc, doc.y);

    const categoryMap = new Map<string, { income: number; expense: number }>();
    for (const row of report.rows) {
      const item = categoryMap.get(row.category) || { income: 0, expense: 0 };
      item.income += row.incomeAmount;
      item.expense += row.expenseAmount;
      categoryMap.set(row.category, item);
    }
    const categories = [...categoryMap.entries()].sort((left, right) => (right[1].income + right[1].expense) - (left[1].income + left[1].expense));

    ensureSpace(doc, 80);
    drawSectionTitle(doc, 'Rekap Kategori');
    const categoryHeaderY = doc.y;
    drawCell(doc, 'KATEGORI', MARGIN, 200, categoryHeaderY, { bold: true });
    drawCell(doc, 'PEMASUKAN', MARGIN + 200, 110, categoryHeaderY, { align: 'right', bold: true });
    drawCell(doc, 'PENGELUARAN', MARGIN + 310, USABLE_WIDTH - 310, categoryHeaderY, { align: 'right', bold: true });
    doc.y = categoryHeaderY + 18;
    drawDivider(doc, doc.y);
    for (const [category, totals] of categories) {
      ensureSpace(doc, 16);
      const y = doc.y;
      drawCell(doc, category, MARGIN, 200, y);
      drawCell(doc, money(totals.income), MARGIN + 200, 110, y, { align: 'right' });
      drawCell(doc, money(totals.expense), MARGIN + 310, USABLE_WIDTH - 310, y, { align: 'right' });
      doc.y = y + 15;
      drawDivider(doc, doc.y);
    }

    const vehicleMap = new Map<string, { income: number; expense: number; sparepart: number; count: number }>();
    for (const row of report.rows) {
      const plate = row.vehiclePlate?.trim();
      if (!plate) continue;
      const item = vehicleMap.get(plate) || { income: 0, expense: 0, sparepart: 0, count: 0 };
      item.income += row.incomeAmount;
      item.expense += row.expenseAmount;
      if (['SPAREPART', 'SPAREPART_MATERIAL', 'SERVICE', 'SERVICE_PAYMENT'].includes(row.category)) item.sparepart += row.expenseAmount;
      item.count += 1;
      vehicleMap.set(plate, item);
    }
    if (vehicleMap.size) {
      ensureSpace(doc, 80);
      drawSectionTitle(doc, 'Rekap per Kendaraan');
      const vehicleHeaderY = doc.y;
      drawCell(doc, 'PLAT', MARGIN, 110, vehicleHeaderY, { bold: true });
      drawCell(doc, 'SPAREPART & SERVICE', MARGIN + 110, 130, vehicleHeaderY, { align: 'right', bold: true });
      drawCell(doc, 'PENGELUARAN', MARGIN + 240, 120, vehicleHeaderY, { align: 'right', bold: true });
      drawCell(doc, 'PEMASUKAN', MARGIN + 360, 110, vehicleHeaderY, { align: 'right', bold: true });
      drawCell(doc, 'JML', MARGIN + 470, USABLE_WIDTH - 430, vehicleHeaderY, { align: 'right', bold: true });
      doc.y = vehicleHeaderY + 18;
      drawDivider(doc, doc.y);
      const vehicles = [...vehicleMap.entries()].sort((left, right) => right[1].expense - left[1].expense);
      for (const [plate, totals] of vehicles) {
        ensureSpace(doc, 16);
        const y = doc.y;
        drawCell(doc, plate, MARGIN, 110, y);
        drawCell(doc, money(totals.sparepart), MARGIN + 110, 130, y, { align: 'right' });
        drawCell(doc, money(totals.expense), MARGIN + 240, 120, y, { align: 'right' });
        drawCell(doc, money(totals.income), MARGIN + 360, 110, y, { align: 'right' });
        drawCell(doc, String(totals.count), MARGIN + 470, USABLE_WIDTH - 430, y, { align: 'right' });
        doc.y = y + 15;
        drawDivider(doc, doc.y);
      }
    }

    doc.end();
  });
  return filePath;
}
