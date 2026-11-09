import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { DailyCashReport, DailyCashRow } from '../domain/ledger-models.js';

const SPAREPART_CATEGORIES = new Set(['SPAREPART', 'SPAREPART_MATERIAL', 'SERVICE', 'SERVICE_PAYMENT']);
const OPERATIONAL_CATEGORIES = new Set(['OPERATIONAL', 'HOSPITALITY', 'EMPLOYEE_BENEFIT', 'GARAGE_EXPENSE', 'COMMISSION']);
const COLORS = { teal: 'FF0D5C5E', light: 'FFE7F1EF', line: 'FFC9D9D5', ink: 'FF173B3C', white: 'FFFFFFFF' };
const MONEY = '#,##0';
const MONTHS = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

type Vehicle = { plate: string; contract: number; collection: number; sparepart: number; operational: number; expense: number; income: number; count: number };
type Totals = { contract: number; collection: number; borongan: number; sparepart: number; operational: number; other: number };

function normalizePlate(value?: string): string { return (value || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function isCollection(row: DailyCashRow): boolean { return row.settlementKind ? row.settlementKind === 'collection' : /tagihan/i.test(row.description); }
function formatDate(value: string): string { const [y, m, d] = value.split('-'); return y && m && d ? `${d}/${m}/${y}` : value; }

function periodLabel(from: string, to: string): string {
  if (from.slice(0, 7) === to.slice(0, 7)) return `PERIODE ${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
  return `PERIODE ${formatDate(from)} - ${formatDate(to)}`;
}

function vehicles(rows: DailyCashRow[]): Vehicle[] {
  const map = new Map<string, Vehicle>();
  for (const row of rows) {
    const plate = normalizePlate(row.vehiclePlate);
    if (!plate) continue;
    const item = map.get(plate) || { plate, contract: 0, collection: 0, sparepart: 0, operational: 0, expense: 0, income: 0, count: 0 };
    if (row.transactionType === 'income') { item.income += row.incomeAmount; if (isCollection(row)) item.collection += row.incomeAmount; else item.contract += row.incomeAmount; }
    else { item.expense += row.expenseAmount; if (SPAREPART_CATEGORIES.has(row.category)) item.sparepart += row.expenseAmount; else if (OPERATIONAL_CATEGORIES.has(row.category)) item.operational += row.expenseAmount; }
    item.count += 1;
    map.set(plate, item);
  }
  return [...map.values()].sort((a, b) => b.expense - a.expense);
}

function categories(rows: DailyCashRow[]): Array<{ name: string; income: number; expense: number }> {
  const map = new Map<string, { name: string; income: number; expense: number }>();
  for (const row of rows) { const item = map.get(row.category) || { name: row.category, income: 0, expense: 0 }; item.income += row.incomeAmount; item.expense += row.expenseAmount; map.set(row.category, item); }
  return [...map.values()].sort((a, b) => b.income + b.expense - a.income - a.expense);
}

function totals(rows: DailyCashRow[]): Totals {
  const total: Totals = { contract: 0, collection: 0, borongan: 0, sparepart: 0, operational: 0, other: 0 };
  for (const row of rows) {
    if (row.transactionType === 'income') { if (isCollection(row)) total.collection += row.incomeAmount; else { total.contract += row.incomeAmount; total.borongan += row.boronganAmount || 0; } }
    else if (SPAREPART_CATEGORIES.has(row.category)) total.sparepart += row.expenseAmount;
    else if (OPERATIONAL_CATEGORIES.has(row.category)) total.operational += row.expenseAmount;
    else total.other += row.expenseAmount;
  }
  return total;
}

function rowsForVehicle(rows: DailyCashRow[], plate: string): DailyCashRow[] { return rows.filter((row) => normalizePlate(row.vehiclePlate) === plate); }

function vehicleGrid(rows: DailyCashRow[], report: DailyCashReport, plate: string): { grid: unknown[][]; money: number[] } {
  const yearRows = rowsForVehicle(rows, plate);
  const title: unknown[][] = [['LAPORAN KEUANGAN'], [`[ ${plate} ]`], [periodLabel(report.from, report.to)]];
  const header = ['TGL', 'KETERANGAN', 'KONTRAK', 'BORONGAN', 'SETORAN', 'SETORAN MASUK', 'SETORAN GANTUNG', 'SPAREPART'];
  const detail: unknown[][] = [];
  let contract = 0; let borongan = 0; let incoming = 0; let sparepart = 0;
  const others: Array<[string, number]> = [];
  for (const row of yearRows) {
    if (row.transactionType === 'income' && isCollection(row)) { incoming += row.incomeAmount; detail.push([formatDate(row.transactionDate), row.description, '', '', '', row.incomeAmount, '', '']); }
    else if (row.transactionType === 'income') { const b = row.boronganAmount || 0; contract += row.incomeAmount; borongan += b; detail.push([formatDate(row.transactionDate), row.description, row.incomeAmount, b || '', row.incomeAmount - b, '', row.incomeAmount - b, '']); }
    else if (SPAREPART_CATEGORIES.has(row.category)) { sparepart += row.expenseAmount; detail.push([formatDate(row.transactionDate), row.description, '', '', '', '', '', row.expenseAmount]); }
    else others.push([row.description, row.expenseAmount]);
  }
  const setoran = contract - borongan;
  const gantung = setoran - incoming;
  const grid: unknown[][] = [...title, header, ...detail, ['', 'TOTAL', contract, borongan, setoran, incoming, gantung, sparepart], ['', 'Setoran', setoran], ['', 'Setoran Gantung', gantung], ['', 'Setoran Masuk', incoming], ['', 'Sparepart', sparepart], ['', 'Sisa Pendapatan', setoran - sparepart]];
  let sisa = setoran - sparepart;
  for (const [label, amount] of others) { sisa -= amount; grid.push(['', label, amount], ['', 'Sisa Pendapatan', sisa]); }
  grid.push(['', 'Total Pendapatan', sisa]);
  return { grid, money: [3, 4, 5, 6, 7, 8] };
}

function writeSheet(workbook: ExcelJS.Workbook, name: string, grid: unknown[][], widths: number[], money: number[] = [], options: { titleRows?: number; headerRow?: number; boldLastRow?: boolean } = {}): void {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  grid.forEach((row) => sheet.addRow(row));
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  money.forEach((column) => {
    const columnRef = sheet.getColumn(column);
    columnRef.numFmt = MONEY;
    columnRef.eachCell({ includeEmpty: false }, (cell) => { if (typeof cell.value === 'number') cell.numFmt = MONEY; });
  });
  const titleRows = options.titleRows || 0;
  const headerRow = options.headerRow ?? (titleRows ? titleRows + 1 : 1);
  sheet.eachRow((row, rowNumber) => {
    const isTitle = titleRows > 0 && rowNumber <= titleRows;
    const isHeader = rowNumber === headerRow;
    const isLast = options.boldLastRow && rowNumber === sheet.rowCount;
    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin', color: { argb: COLORS.line } }, bottom: { style: 'thin', color: { argb: COLORS.line } }, left: { style: 'thin', color: { argb: COLORS.line } }, right: { style: 'thin', color: { argb: COLORS.line } } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (isTitle) { cell.font = { name: 'Aptos Display', size: rowNumber === 1 ? 16 : 11, bold: true, color: { argb: COLORS.white } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.teal } }; }
      else if (isHeader) { cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.white } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.teal } }; }
      else { cell.font = { name: 'Aptos', size: 10, bold: isLast, color: { argb: COLORS.ink } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber % 2 === 0 ? COLORS.white : COLORS.light } }; }
    });
  });
  for (let row = 1; row <= titleRows; row += 1) {
    sheet.mergeCells(row, 1, row, Math.max(2, widths.length));
    sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

export async function exportOperationalWorkbook(reportsDir: string, report: DailyCashReport): Promise<string> {
  fs.mkdirSync(reportsDir, { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const vehicleList = vehicles(report.rows);
  const categoryList = categories(report.rows);
  const total = totals(report.rows);
  const setoran = total.contract - total.borongan;
  const gantung = setoran - total.collection;

  writeSheet(workbook, 'Ringkasan', [['LAPORAN KEUANGAN GARASI LAMPUNG'], [], ['Perusahaan', report.companyName], ['Nama laporan', report.reportName], ['Jumlah unit', report.totalUnits], ['Periode mulai', report.from], ['Periode akhir', report.to], ['Saldo awal', report.openingBalance], ['Total pemasukan', report.totalIncome], ['Total pengeluaran', report.totalExpense], ['Saldo akhir', report.closingBalance], [], ['Dibuat', new Date().toISOString()]], [24, 32], [2], { titleRows: 1, headerRow: 1 });
  const cashGrid = [['LAPORAN KEUANGAN GARASI LAMPUNG', '', '', '', '', ''], [`${report.companyName.toUpperCase()} (${report.totalUnits} UNIT)`, '', '', '', '', ''], [periodLabel(report.from, report.to), '', '', '', '', ''], ['NO', 'TANGGAL', 'KETERANGAN', 'PEMASUKAN', 'PENGELUARAN', 'SALDO AKHIR'], ...report.rows.map((row, index) => [index + 1, formatDate(row.transactionDate), row.description, row.incomeAmount || '', row.expenseAmount || '', row.balance]), ['', '', 'TOTAL', report.totalIncome, report.totalExpense, report.closingBalance]];
  writeSheet(workbook, 'Kas Harian', cashGrid, [6, 12, 44, 16, 16, 20], [4, 5, 6], { titleRows: 3, headerRow: 4 });
  writeSheet(workbook, 'Rekap Kategori', [['KATEGORI', 'PEMASUKAN', 'PENGELUARAN'], ...categoryList.map((row) => [row.name, row.income || '', row.expense || ''])], [28, 18, 18], [2, 3]);
  writeSheet(workbook, 'Operasional per Plat', [['NO', 'PLAT', 'TOTAL PENGELUARAN', 'SPAREPART & SERVICE', 'OPERASIONAL', 'PEMASUKAN', 'JML TRANSAKSI'], ...[...vehicleList].sort((a, b) => b.sparepart - a.sparepart).map((row, index) => [index + 1, row.plate, row.expense, row.sparepart, row.operational, row.income, row.count])], [6, 16, 20, 22, 18, 16, 14], [3, 4, 5, 6]);
  writeSheet(workbook, 'Rekap Garasi', [['REKAP GARASI'], [], ['Total pendapatan kontrak', total.contract], ['Total pemasukan kas (tagihan muat)', total.collection], ['Total pengeluaran', report.totalExpense], ['Saldo kas', report.closingBalance], ['Setoran gantung (piutang)', gantung], ['Biaya sparepart & service', total.sparepart], ['Biaya operasional', total.operational + total.other]], [42, 30], [2], { titleRows: 1, headerRow: 1 });
  writeSheet(workbook, 'Rekonsiliasi', [['REKONSILIASI CASH VS ACCRUAL'], [], ['Kontrak muat (accrual)', total.contract], ['Borongan', total.borongan], ['Setoran (kontrak - borongan)', setoran], ['Setoran masuk (cash)', total.collection], ['Setoran gantung (piutang)', gantung]], [42, 30], [2], { titleRows: 1, headerRow: 1 });
  for (const vehicle of vehicleList) {
    const yearRows = rowsForVehicle(report.rows, vehicle.plate);
    if (yearRows.some((row) => row.transactionType === 'income' || SPAREPART_CATEGORIES.has(row.category) || OPERATIONAL_CATEGORIES.has(row.category))) {
      const { grid, money } = vehicleGrid(report.rows, report, vehicle.plate);
      writeSheet(workbook, vehicle.plate, grid, [12, 44, 16, 16, 16, 16, 16, 16], money, { titleRows: 3, headerRow: 4, boldLastRow: true });
    }
  }
  writeSheet(workbook, 'Petunjuk', [['PETUNJUK'], ['Sheet Kas Harian mengikuti format template kas harian: NO, TANGGAL, KETERANGAN, PEMASUKAN, PENGELUARAN, SALDO AKHIR.'], ['Sheet per kendaraan mengikuti format Laporan Mobil: KONTRAK, BORONGAN, SETORAN, SETORAN MASUK, SETORAN GANTUNG, SPAREPART, plus ringkasan biaya dan Total Pendapatan.'], ['Rekap Garasi dan Rekonsiliasi membedakan pendapatan accrual dengan kas masuk.']], [110], [], { titleRows: 1, headerRow: 1 });

  const filePath = path.join(reportsDir, `garasi-${report.from}-${report.to}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}
