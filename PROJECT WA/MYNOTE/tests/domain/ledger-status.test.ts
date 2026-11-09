import { describe, expect, it } from 'vitest';
import { canTransition, hasConflictingAmounts } from '../../src/domain/ledger-models.js';

describe('ledger status transitions', () => {
  it('allows pending to posted and cancelled', () => {
    expect(canTransition('pending', 'posted')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });

  it('allows posted to cancelled only', () => {
    expect(canTransition('posted', 'cancelled')).toBe(true);
    expect(canTransition('posted', 'posted')).toBe(false);
    expect(canTransition('posted', 'pending')).toBe(false);
  });

  it('allows cancelled to posted as restore', () => {
    expect(canTransition('cancelled', 'posted')).toBe(true);
  });
});

describe('ledger amount validation', () => {
  it('rejects updates where income and expense are both positive', () => {
    expect(hasConflictingAmounts({ transactionDate: '2026-11-08', description: 'x', transactionType: 'income', category: 'x', incomeAmount: 1000, expenseAmount: 1000 })).toBe(true);
    expect(hasConflictingAmounts({ transactionDate: '2026-11-08', description: 'x', transactionType: 'income', category: 'x', incomeAmount: 1000, expenseAmount: 0 })).toBe(false);
  });
});
