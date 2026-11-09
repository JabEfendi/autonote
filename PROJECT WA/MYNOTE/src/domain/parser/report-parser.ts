export type ReportFormat = 'pdf' | 'xlsx' | 'both';
export type ReportPeriod = 'hari ini' | 'minggu ini' | 'bulan ini';
export type ReportCommand = { format: ReportFormat; period: ReportPeriod };

export function parseReportCommand(text: string): ReportCommand | null {
  const value = text.trim().toLowerCase();
  const bang = value.match(/^!laporan\s+(hari ini|minggu ini|bulan ini)$/);
  if (bang) return { format: 'both', period: bang[1] as ReportPeriod };
  const hash = value.match(/^#laporan(?:\s+(pdf|excel))?\s+(hari ini|minggu ini|bulan ini)$/);
  if (!hash) return null;
  return { format: hash[1] === 'pdf' ? 'pdf' : hash[1] === 'excel' ? 'xlsx' : 'both', period: hash[2] as ReportPeriod };
}

export function parseRulesCommand(text: string): boolean {
  return text.trim().toLowerCase() === '!rules';
}
