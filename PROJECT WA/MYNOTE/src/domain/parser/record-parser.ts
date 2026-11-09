import type { ParseResult, ParsedRecord, RecordType } from '../models.js';

const labels: Record<string, keyof ParsedRecord> = {
  tanggal: 'transactionDate',
  jenis: 'type',
  kategori: 'category',
  keterangan: 'description',
  nominal: 'amountMinor'
};

function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(normalized)) return null;
  const decimal = normalized.includes(',') ? normalized.lastIndexOf(',') : -1;
  const integerPart = decimal >= 0 ? normalized.slice(0, decimal) : normalized;
  const fraction = decimal >= 0 ? normalized.slice(decimal + 1) : '';
  const digits = integerPart.replace(/[.,]/g, '');
  if (!digits || (fraction && !/^\d{1,2}$/.test(fraction))) return null;
  const minor = Number(`${digits}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function validDate(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return date.getUTCFullYear() === Number(match[3]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[1]);
}

export function parseRecordMessage(text: string, currency = 'IDR'): ParseResult {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines[0]?.toLowerCase() !== '#catat') return { recognizedCommand: null, valid: false, errors: [], warnings: [] };
  const values: Partial<Record<keyof ParsedRecord, string | number>> = {};
  const errors: string[] = [];
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(':');
    if (separator < 1) { errors.push(`Baris tidak dikenali: ${line}`); continue; }
    const rawLabel = line.slice(0, separator).trim().toLowerCase();
    const key = labels[rawLabel];
    if (!key) { errors.push(`Label tidak dikenali: ${rawLabel}`); continue; }
    if (key in values) { errors.push(`Label duplikat: ${rawLabel}`); continue; }
    const rawValue = line.slice(separator + 1).trim();
    if (!rawValue) { errors.push(`Nilai ${rawLabel} wajib diisi`); continue; }
    if (key === 'amountMinor') values[key] = parseAmount(rawValue) ?? NaN;
    else values[key] = rawValue;
  }
  const required: Array<[keyof ParsedRecord, string]> = [['transactionDate', 'tanggal'], ['type', 'jenis'], ['category', 'kategori'], ['description', 'keterangan'], ['amountMinor', 'nominal']];
  for (const [key, label] of required) if (values[key] === undefined) errors.push(`${label} wajib diisi`);
  if (typeof values.transactionDate === 'string' && !validDate(values.transactionDate)) errors.push('tanggal harus berformat DD/MM/YYYY dan valid');
  if (values.type !== 'pemasukan' && values.type !== 'pengeluaran') errors.push('jenis harus pemasukan atau pengeluaran');
  if (typeof values.amountMinor !== 'number' || !Number.isSafeInteger(values.amountMinor) || values.amountMinor <= 0) errors.push('nominal harus angka positif');
  if (errors.length) return { recognizedCommand: '#catat', valid: false, errors, warnings: [] };
  return { recognizedCommand: '#catat', valid: true, record: { transactionDate: values.transactionDate as string, type: values.type as RecordType, category: values.category as string, description: values.description as string, amountMinor: values.amountMinor as number, currency }, errors: [], warnings: [] };
}
