import type { LedgerTransactionDraft } from '../ledger-models.js';

export type LedgerParseResult = { recognized: boolean; valid: boolean; transaction?: LedgerTransactionDraft; errors: string[] };

const categoryRules: Array<{ pattern: RegExp; category: string; subcategory?: string }> = [
  { pattern: /oli\s+mesin/i, category: 'SPAREPART', subcategory: 'oli_mesin' },
  { pattern: /besi\s+pipa/i, category: 'SPAREPART_MATERIAL', subcategory: 'besi_pipa' },
  { pattern: /pompa\s+solar/i, category: 'SPAREPART', subcategory: 'pompa_solar' },
  { pattern: /selang\s+solar/i, category: 'SPAREPART', subcategory: 'selang_solar' },
  { pattern: /kabel\s+body/i, category: 'SERVICE', subcategory: 'service_kabel_body' },
  { pattern: /bengkel|las|bubut/i, category: 'SERVICE_PAYMENT', subcategory: 'service_payment' },
  { pattern: /parkir/i, category: 'OPERATIONAL', subcategory: 'parkir' },
  { pattern: /operasional|perjalanan|\bpp\b/i, category: 'OPERATIONAL', subcategory: 'operasional_perjalanan' },
  { pattern: /makan|rokok\s+tamu/i, category: 'HOSPITALITY', subcategory: 'makan_rokok_tamu' },
  { pattern: /bpjs/i, category: 'EMPLOYEE_BENEFIT', subcategory: 'bpjs' },
  { pattern: /bulanan\s+garasi/i, category: 'GARAGE_EXPENSE', subcategory: 'bulanan_garasi' },
  { pattern: /fee\s+makelar/i, category: 'COMMISSION', subcategory: 'fee_makelar' },
  { pattern: /fee\s+herman/i, category: 'COMMISSION', subcategory: 'fee_herman' },
  { pattern: /setor/i, category: 'SETTLEMENT', subcategory: 'setoran' }
];

function parseAmount(value: string): number | null {
  const normalized = value.toLowerCase().replace(/rp\.?/g, '').replace(/\s/g, '').replace(/,$/, '');
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/);
  if (!match) return null;
  const number = Number(match[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) return null;
  const multiplier = match[2] === 'juta' || match[2] === 'jt' ? 1000000 : match[2] === 'ribu' || match[2] === 'rb' || match[2] === 'k' ? 1000 : 1;
  return Math.round(number * multiplier);
}

function parseDate(text: string): string { return text.match(/\d{2}\/\d{2}\/\d{4}/)?.[0].split('/').reverse().join('-') || new Date().toISOString().slice(0, 10); }
function parseRoute(text: string): { origin?: string; destination?: string } { const match = text.match(/(?:muat|tagihan\s+muat)\s+([a-z]+)\s+-\s*([a-z]+)/i); return match ? { origin: match[1], destination: match[2] } : {}; }
function parseVehicle(text: string): string | undefined { return text.match(/\b[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{1,3}\b/i)?.[0].replace(/\s+/g, ' ').toUpperCase(); }

export function parseLedgerMessage(text: string): LedgerParseResult {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) return { recognized: false, valid: false, errors: [] };
  const lower = normalized.toLowerCase();
  const hasAmount = /\d[\d.,]*\s*(juta|jt|ribu|rb|k)?\b/i.test(normalized);
  const isKnown = /\b(muat|tagihan|oli|parkir|fee|setor|bengkel|service|operasional|bpjs|bulanan|pompa|besi|pindahan|transfer|makan|rokok|borong)\b/i.test(normalized);
  if (!hasAmount || !isKnown) return { recognized: false, valid: false, errors: [] };
  const boronganMatch = normalized.match(/(?:borong(?:an)?)\s*[:=]?\s*([\d.,]+\s*(?:juta|jt|ribu|rb|k)?)/i);
  const borongan = boronganMatch ? (parseAmount(boronganMatch[1]) ?? undefined) : undefined;
  const amountScan = boronganMatch ? normalized.replace(boronganMatch[0], ' ') : normalized;
  const amountMatch = amountScan.match(/\d[\d.,]*\s*(?:juta|jt|ribu|rb|k)?\b/gi)?.at(-1);
  const amount = amountMatch ? parseAmount(amountMatch) : null;
  const isTransfer = /pindahan|transfer/i.test(lower);
  const isCollection = /tagihan\s+muat/i.test(lower);
  const isContract = /\bmuat\b/i.test(lower) && !isCollection;
  const isIncome = !isTransfer && (isCollection || isContract);
  const route = parseRoute(normalized);
  const categoryRule = categoryRules.find((rule) => rule.pattern.test(normalized));
  const isServicePayment = /bengkel/i.test(lower);
  const description = normalized.split('\n').filter(Boolean).join(' - ');
  const installment = normalized.match(/setor(?:an)?\s*(?:ke[- ]?)?(\d+)/i)?.[1];
  const quantityMatch = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(liter|kg|unit|buah)\b/i);
  const errors: string[] = [];
  if (!amount) errors.push('Nominal transaksi tidak ditemukan atau tidak valid');
  if (!categoryRule && !isTransfer && !isIncome) errors.push('Kategori transaksi belum dikenali');
  if (errors.length) return { recognized: true, valid: false, errors };
  const transaction: LedgerTransactionDraft = {
    transactionDate: parseDate(normalized), description, transactionType: isTransfer ? 'transfer' : isIncome ? 'income' : 'expense',
    category: isTransfer ? 'TRANSFER' : isIncome ? 'SHIPMENT_PAYMENT' : isServicePayment ? 'SERVICE_PAYMENT' : categoryRule?.category || 'OTHER',
    subcategory: categoryRule?.subcategory, incomeAmount: isIncome ? amount! : 0, expenseAmount: !isIncome && !isTransfer ? amount! : 0,
    settlementKind: isIncome ? (isCollection ? 'collection' : 'contract') : undefined, boronganAmount: isIncome && !isCollection ? borongan : undefined,
    vehiclePlate: parseVehicle(normalized), quantity: quantityMatch ? Number(quantityMatch[1].replace(',', '.')) : undefined, unit: quantityMatch?.[2], routeOrigin: route.origin, routeDestination: route.destination,
    counterparty: normalized.match(/bengkel(?:\s+las)?\s+([a-z]+)/i)?.[1] || normalized.match(/fee\s+([a-z]+)/i)?.[1], installmentNumber: installment ? Number(installment) : undefined
  };
  return { recognized: true, valid: true, transaction, errors: [] };
}
