import type { DailyCashRow } from '../domain/ledger-models.js';

export type VehicleReport = { vehiclePlate: string; income: number; expense: number; balance: number; transactionCount: number; rows: DailyCashRow[] };

export function buildVehicleReports(rows: DailyCashRow[]): VehicleReport[] {
  const groups = new Map<string, DailyCashRow[]>();
  for (const row of rows) if (row.vehiclePlate) groups.set(row.vehiclePlate, [...(groups.get(row.vehiclePlate) || []), row]);
  return [...groups].map(([vehiclePlate, vehicleRows]) => ({ vehiclePlate, income: vehicleRows.reduce((sum, row) => sum + row.incomeAmount, 0), expense: vehicleRows.reduce((sum, row) => sum + row.expenseAmount, 0), balance: vehicleRows.reduce((sum, row) => sum + row.incomeAmount - row.expenseAmount, 0), transactionCount: vehicleRows.length, rows: vehicleRows }));
}
