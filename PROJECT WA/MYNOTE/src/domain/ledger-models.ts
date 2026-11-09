export type CashTransactionType = 'income' | 'expense' | 'transfer';
export type CashTransactionStatus = 'pending' | 'posted' | 'cancelled';
export type SettlementKind = 'contract' | 'collection';

export type LedgerTransactionDraft = {
  transactionDate: string;
  description: string;
  transactionType: CashTransactionType;
  category: string;
  subcategory?: string;
  incomeAmount: number;
  expenseAmount: number;
  vehiclePlate?: string;
  quantity?: number;
  unit?: string;
  routeOrigin?: string;
  routeDestination?: string;
  counterparty?: string;
  referenceNumber?: string;
  installmentNumber?: number;
  settlementKind?: SettlementKind;
  boronganAmount?: number;
  sourceMessageId?: string;
};

export type LedgerTransactionUpdate = Partial<Omit<LedgerTransactionDraft, 'sourceMessageId'>>;

export const LEDGER_STATUS_TRANSITIONS: Record<CashTransactionStatus, CashTransactionStatus[]> = {
  pending: ['posted', 'cancelled'],
  posted: ['cancelled'],
  cancelled: ['posted']
};

export function canTransition(from: CashTransactionStatus, to: CashTransactionStatus): boolean {
  return LEDGER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function hasConflictingAmounts(update: LedgerTransactionDraft | LedgerTransactionUpdate): boolean {
  const income = Number(update.incomeAmount || 0);
  const expense = Number(update.expenseAmount || 0);
  return income > 0 && expense > 0;
}

export type DailyCashRow = LedgerTransactionDraft & {
  id: number;
  balance: number;
  status: CashTransactionStatus;
  createdAt: string;
};

export type LedgerTransactionRecord = LedgerTransactionDraft & {
  id: number;
  status: CashTransactionStatus;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyCashReport = {
  reportName: string;
  companyName: string;
  totalUnits: number;
  from: string;
  to: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
  rows: DailyCashRow[];
};
