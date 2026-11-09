import { describe, expect, it } from 'vitest';
import { parseRecordMessage } from '../../src/domain/parser/record-parser.js';

describe('record parser', () => {
  it('parses Indonesian amount formats without floating point storage', () => {
    const result = parseRecordMessage('#catat\ntanggal: 04/11/2026\njenis: pengeluaran\nkategori: operasional\nketerangan: ATK\nnominal: 250.000,50');
    expect(result.valid).toBe(true); expect(result.record?.amountMinor).toBe(25000050);
  });
  it('returns field errors', () => { const result = parseRecordMessage('#catat\njenis: salah'); expect(result.valid).toBe(false); expect(result.errors).toContain('jenis harus pemasukan atau pengeluaran'); });
});
