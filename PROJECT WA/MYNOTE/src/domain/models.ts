export type RecordType = 'pemasukan' | 'pengeluaran';

export type ParsedRecord = {
  transactionDate: string;
  type: RecordType;
  category: string;
  description: string;
  amountMinor: number;
  currency: string;
};

export type ParseResult = {
  recognizedCommand: string | null;
  valid: boolean;
  record?: ParsedRecord;
  errors: string[];
  warnings: string[];
};

export type StoredRecord = ParsedRecord & {
  id: number;
  messageId: string;
  groupId: string;
  createdAt: string;
};
