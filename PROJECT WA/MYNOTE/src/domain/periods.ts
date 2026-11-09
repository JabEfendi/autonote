import type { ReportPeriod } from './parser/report-parser.js';

const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });

function dateFromParts(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function getReportRange(period: ReportPeriod, now = new Date()): { from: string; to: string } {
  const parts = dateParts.formatToParts(now);
  const current = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
  const end = dateFromParts(current);
  if (period === 'hari ini') return { from: current, to: current };
  if (period === 'minggu ini') {
    const day = end.getUTCDay() || 7;
    const from = new Date(end);
    from.setUTCDate(end.getUTCDate() - day + 1);
    return { from: isoDate(from), to: current };
  }
  const from = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { from: isoDate(from), to: current };
}
