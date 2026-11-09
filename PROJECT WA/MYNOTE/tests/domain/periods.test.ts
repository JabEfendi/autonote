import { describe, expect, it } from 'vitest';
import { getReportRange } from '../../src/domain/periods.js';

describe('report periods', () => {
  const now = new Date('2026-11-04T18:00:00.000Z');

  it('uses Jakarta local date', () => {
    expect(getReportRange('hari ini', now)).toEqual({ from: '2026-11-05', to: '2026-11-05' });
  });

  it('calculates Monday through current date for the week', () => {
    expect(getReportRange('minggu ini', now)).toEqual({ from: '2026-11-02', to: '2026-11-05' });
  });

  it('calculates the first day through current date for the month', () => {
    expect(getReportRange('bulan ini', now)).toEqual({ from: '2026-11-01', to: '2026-11-05' });
  });
});
