import { describe, expect, it } from 'vitest';
import { parseReportCommand, parseRulesCommand } from '../../src/domain/parser/report-parser.js';

describe('report commands', () => {
  it('parses !laporan as Excel and PDF', () => {
    expect(parseReportCommand('!laporan minggu ini')).toEqual({ format: 'both', period: 'minggu ini' });
  });

  it('parses default #laporan as Excel and PDF', () => {
    expect(parseReportCommand('#laporan minggu ini')).toEqual({ format: 'both', period: 'minggu ini' });
  });

  it('parses Excel reports', () => {
    expect(parseReportCommand('#laporan excel bulan ini')).toEqual({ format: 'xlsx', period: 'bulan ini' });
  });

  it('parses PDF reports', () => {
    expect(parseReportCommand('#laporan pdf hari ini')).toEqual({ format: 'pdf', period: 'hari ini' });
  });

  it('rejects unsupported commands', () => {
    expect(parseReportCommand('#laporan besok')).toBeNull();
  });

  it('recognizes the rules command', () => {
    expect(parseRulesCommand('!rules')).toBe(true);
    expect(parseRulesCommand('!laporan')).toBe(false);
  });
});
