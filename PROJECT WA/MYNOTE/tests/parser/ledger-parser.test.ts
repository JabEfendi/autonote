import { describe, expect, it } from 'vitest';
import { parseLedgerMessage } from '../../src/domain/parser/ledger-parser.js';

describe('ledger parser', () => {
  it('parses vehicle sparepart expenses', () => {
    const result = parseLedgerMessage('BH 8520 AO\nOli mesin 2 liter 130rb');
    expect(result.valid).toBe(true);
    expect(result.transaction).toMatchObject({ transactionType: 'expense', category: 'SPAREPART', subcategory: 'oli_mesin', vehiclePlate: 'BH 8520 AO', quantity: 2, unit: 'liter', expenseAmount: 130000 });
  });

  it('parses shipment payment income and route', () => {
    const result = parseLedgerMessage('Tagihan muat Jakarta - Palembang\n6 juta');
    expect(result.valid).toBe(true);
    expect(result.transaction).toMatchObject({ transactionType: 'income', category: 'SHIPMENT_PAYMENT', settlementKind: 'collection', routeOrigin: 'Jakarta', routeDestination: 'Palembang', incomeAmount: 6000000 });
  });

  it('separates Muat contract income from borongan amount', () => {
    const result = parseLedgerMessage('Muat Jakarta - Palembang\n6 juta borongan 4,5 juta');
    expect(result.valid).toBe(true);
    expect(result.transaction).toMatchObject({ transactionType: 'income', category: 'SHIPMENT_PAYMENT', settlementKind: 'contract', incomeAmount: 6000000, boronganAmount: 4500000 });
  });

  it('parses service payment vendor', () => {
    const result = parseLedgerMessage('Bayar bengkel las Gareng\n3,15 juta');
    expect(result.valid).toBe(true);
    expect(result.transaction).toMatchObject({ transactionType: 'expense', category: 'SERVICE_PAYMENT', expenseAmount: 3150000, counterparty: 'Gareng' });
  });

  it('keeps transfers out of income and expense', () => {
    const result = parseLedgerMessage('Pindahan antar kas 500rb');
    expect(result.valid).toBe(true);
    expect(result.transaction).toMatchObject({ transactionType: 'transfer', incomeAmount: 0, expenseAmount: 0 });
  });
});
