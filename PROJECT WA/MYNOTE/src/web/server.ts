import { createServer, type IncomingMessage as HttpIncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/index.js';
import { PostgresRepository } from '../persistence/postgres.js';
import { MyNoteServices } from '../application/services.js';
import { createWhatsAppRuntime } from './whatsapp-runtime.js';
import { exportOperationalWorkbook } from '../reporting/operational-workbook.js';
import { exportLedgerPdf } from '../reporting/ledger-pdf.js';
import { buildVehicleReports } from '../reporting/vehicle-report.js';
import type { CashTransactionType, SettlementKind } from '../domain/ledger-models.js';
import { installLogCapture, listLogs, clearLogs } from '../application/log-store.js';

installLogCapture();

const config = loadConfig();
const repository = new PostgresRepository({ ...config.postgres, connectionTimeoutMillis: 10000 });
await repository.initialize();
const services = new MyNoteServices(repository, config);
const whatsapp = createWhatsAppRuntime(config, services);
void whatsapp.connect().catch((error) => console.error('[whatsapp] auto-connect failed:', error instanceof Error ? error.message : error));
const webRoot = path.resolve(process.cwd(), 'src/web');
const finish = (response: ServerResponse, body?: string | Buffer): void => {
  (response as unknown as { end: (chunk?: string | Buffer) => void }).end(body);
};

function todayInJakarta(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

function optionalOpening(url: URL): number | undefined {
  const value = url.searchParams.get('openingBalance');
  return value === null || value === '' ? undefined : Number(value);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  finish(response, JSON.stringify(body));
}

async function serveFile(response: ServerResponse, fileName: string, contentType: string): Promise<void> {
  try {
    const content = await new Promise<Buffer>((resolve, reject) => readFile(path.join(webRoot, fileName), (error, data) => error ? reject(error) : resolve(data)));
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
    finish(response, content);
  } catch {
    response.writeHead(404);
    finish(response, 'Not found');
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/dashboard') {
      const to = url.searchParams.get('to') || todayInJakarta();
      const from = url.searchParams.get('from') || to.slice(0, 8) + '01';
      sendJson(response, 200, await repository.getDashboardData(from, to));
      return;
    }
    if (url.pathname === '/api/reports/daily-cash' && request.method === 'GET') {
      const to = url.searchParams.get('to') || todayInJakarta();
      const from = url.searchParams.get('from') || to;
      const opening = optionalOpening(url);
      sendJson(response, 200, await repository.getDailyCashReport(from, to, opening));
      return;
    }
    if (url.pathname === '/api/reports/daily-cash.xlsx' && request.method === 'GET') {
      const to = url.searchParams.get('to') || todayInJakarta();
      const from = url.searchParams.get('from') || to;
      const report = await repository.getDailyCashReport(from, to, optionalOpening(url));
      const filePath = await exportOperationalWorkbook(config.reportsDir, report);
      const file = await new Promise<Buffer>((resolve, reject) => readFile(filePath, (error, data) => error ? reject(error) : resolve(data)));
      response.writeHead(200, { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${path.basename(filePath)}"` });
      finish(response, file);
      return;
    }
    if (url.pathname === '/api/reports/daily-cash.pdf' && request.method === 'GET') {
      const to = url.searchParams.get('to') || todayInJakarta();
      const from = url.searchParams.get('from') || to;
      const report = await repository.getDailyCashReport(from, to, optionalOpening(url));
      const filePath = await exportLedgerPdf(config.reportsDir, report);
      const file = await new Promise<Buffer>((resolve, reject) => readFile(filePath, (error, data) => error ? reject(error) : resolve(data)));
      response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${path.basename(filePath)}"` });
      finish(response, file);
      return;
    }
    if (url.pathname === '/api/reports/vehicles' && request.method === 'GET') {
      const to = url.searchParams.get('to') || todayInJakarta();
      const from = url.searchParams.get('from') || to.slice(0, 8) + '01';
      const report = await repository.getDailyCashReport(from, to, optionalOpening(url));
      sendJson(response, 200, { from, to, vehicles: buildVehicleReports(report.rows) });
      return;
    }
    if (url.pathname === '/api/report-profile' && request.method === 'GET') {
      sendJson(response, 200, await repository.getReportProfile());
      return;
    }
    if (url.pathname === '/api/report-profile' && request.method === 'PUT') {
      const body = await readJson(request) as { companyName?: string; reportName?: string; totalUnits?: number; openingBalance?: number };
      if (typeof body.companyName !== 'string' || typeof body.reportName !== 'string' || typeof body.totalUnits !== 'number' || typeof body.openingBalance !== 'number') {
        sendJson(response, 400, { error: 'companyName, reportName, totalUnits, dan openingBalance wajib diisi.' });
        return;
      }
      sendJson(response, 200, await repository.saveReportProfile({ companyName: body.companyName.trim(), reportName: body.reportName.trim(), totalUnits: body.totalUnits, openingBalance: body.openingBalance }));
      return;
    }
    if (url.pathname === '/api/ledger' && request.method === 'GET') {
      sendJson(response, 200, { transactions: await repository.listLedgerTransactions(url.searchParams.get('from') || undefined, url.searchParams.get('to') || undefined) });
      return;
    }
    const ledgerIdMatch = url.pathname.match(/^\/api\/ledger\/(\d+)(?:\/(cancel|restore))?$/);
    if (ledgerIdMatch && !ledgerIdMatch[2] && request.method === 'PATCH') {
      const body = await readJson(request) as Record<string, unknown>;
      const id = Number(ledgerIdMatch[1]);
      const update = {
        transactionDate: typeof body.transactionDate === 'string' ? body.transactionDate : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        transactionType: body.transactionType === 'income' || body.transactionType === 'expense' || body.transactionType === 'transfer' ? body.transactionType as CashTransactionType : undefined,
        category: typeof body.category === 'string' ? body.category : undefined,
        subcategory: typeof body.subcategory === 'string' ? body.subcategory : undefined,
        incomeAmount: typeof body.incomeAmount === 'number' ? body.incomeAmount : undefined,
        expenseAmount: typeof body.expenseAmount === 'number' ? body.expenseAmount : undefined,
        vehiclePlate: typeof body.vehiclePlate === 'string' ? body.vehiclePlate : undefined,
        quantity: typeof body.quantity === 'number' ? body.quantity : undefined,
        unit: typeof body.unit === 'string' ? body.unit : undefined,
        routeOrigin: typeof body.routeOrigin === 'string' ? body.routeOrigin : undefined,
        routeDestination: typeof body.routeDestination === 'string' ? body.routeDestination : undefined,
        counterparty: typeof body.counterparty === 'string' ? body.counterparty : undefined,
        installmentNumber: typeof body.installmentNumber === 'number' ? body.installmentNumber : undefined,
        settlementKind: body.settlementKind === 'contract' || body.settlementKind === 'collection' ? body.settlementKind as SettlementKind : undefined,
        boronganAmount: typeof body.boronganAmount === 'number' ? body.boronganAmount : undefined
      };
      if (!Object.values(update).some((value) => value !== undefined)) { sendJson(response, 400, { error: 'Tidak ada field koreksi.' }); return; }
      const updated = await repository.updateLedgerTransaction(id, update);
      sendJson(response, updated ? 200 : 404, updated ? { updated: true, id } : { error: 'Transaksi tidak ditemukan atau sudah dibatalkan.' });
      return;
    }
    if (ledgerIdMatch?.[2] === 'cancel' && request.method === 'POST') {
      const body = await readJson(request) as { reason?: string };
      if (!body.reason?.trim()) { sendJson(response, 400, { error: 'Alasan pembatalan wajib diisi.' }); return; }
      const cancelled = await repository.cancelLedgerTransaction(Number(ledgerIdMatch[1]), body.reason.trim());
      sendJson(response, cancelled ? 200 : 409, cancelled ? { cancelled: true } : { error: 'Status transaksi tidak dapat dibatalkan.' });
      return;
    }
    if (ledgerIdMatch?.[2] === 'restore' && request.method === 'POST') {
      const restored = await repository.restoreLedgerTransaction(Number(ledgerIdMatch[1]));
      sendJson(response, restored ? 200 : 409, restored ? { restored: true } : { error: 'Hanya transaksi cancelled yang dapat dipulihkan.' });
      return;
    }
    if (url.pathname === '/api/audit-log' && request.method === 'GET') {
      sendJson(response, 200, { entries: await repository.listAuditLog(Number(url.searchParams.get('limit') || 50)) });
      return;
    }
    if (url.pathname === '/api/command-formats' && request.method === 'GET') { sendJson(response, 200, { formats: await repository.listCommandFormats() }); return; }
    if (url.pathname === '/api/command-formats' && request.method === 'POST') {
      const body = await readJson(request) as { name?: string; command?: string; targetCommand?: string; description?: string; template?: string };
      if (!body.name || !body.command || !body.targetCommand || !body.description || !body.template) { sendJson(response, 400, { error: 'Semua field format perintah wajib diisi.' }); return; }
      sendJson(response, 201, await repository.addCommandFormat({ name: body.name.trim(), command: body.command.trim(), targetCommand: body.targetCommand.trim(), description: body.description.trim(), template: body.template.trim() }));
      return;
    }
    if (url.pathname === '/api/logs' && request.method === 'GET') { sendJson(response, 200, { entries: listLogs(Number(url.searchParams.get('limit') || 200)) }); return; }
    if (url.pathname === '/api/logs' && request.method === 'DELETE') { clearLogs(); sendJson(response, 200, { cleared: true }); return; }
    if (url.pathname === '/api/whatsapp/status' && request.method === 'GET') { sendJson(response, 200, whatsapp.getStatus()); return; }
    if (url.pathname === '/api/whatsapp/groups' && request.method === 'GET') { sendJson(response, 200, { groups: await whatsapp.listGroups() }); return; }
    if (url.pathname === '/api/groups' && request.method === 'GET') { sendJson(response, 200, { groups: await repository.listGroups() }); return; }
    if (url.pathname === '/api/whatsapp/groups' && request.method === 'POST') {
      const body = await readJson(request) as { groups?: Array<{ groupId: string; groupName: string }> };
      await repository.setAllowedGroups(body.groups || []);
      sendJson(response, 200, { groups: await repository.listGroups() });
      return;
    }
    if (url.pathname === '/api/whatsapp/connect' && request.method === 'POST') { await whatsapp.connect(); sendJson(response, 202, whatsapp.getStatus()); return; }
    if (url.pathname === '/api/whatsapp/reset' && request.method === 'POST') { await whatsapp.resetSession(); sendJson(response, 202, whatsapp.getStatus()); return; }
    if (url.pathname === '/api/whatsapp/disconnect' && request.method === 'POST') { await whatsapp.disconnect(); sendJson(response, 200, whatsapp.getStatus()); return; }
    if (url.pathname === '/' || url.pathname === '/index.html') return serveFile(response, 'index.html', 'text/html; charset=utf-8');
    if (url.pathname === '/styles.css') return serveFile(response, 'styles.css', 'text/css; charset=utf-8');
    if (url.pathname === '/app.js') return serveFile(response, 'app.js', 'text/javascript; charset=utf-8');
    response.writeHead(404);
    finish(response, 'Not found');
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

server.on('error', (error) => {
  if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`MYNOTE web port ${config.webPort} is already in use. Stop the previous web process or change WEB_PORT.`);
    process.exitCode = 1;
    return;
  }
  console.error('MYNOTE web server error:', error);
  process.exitCode = 1;
});

server.listen(config.webPort, config.webHost, () => {
  console.log(`MYNOTE web dashboard: http://${config.webHost}:${config.webPort}`);
});

const shutdown = async () => {
  server.close();
  await whatsapp.disconnect();
  await repository.close();
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

async function readJson(request: HttpIncomingMessage): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = request as unknown as { on(event: string, listener: (...args: any[]) => void): void };
    stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (error) { reject(error); }
    });
    stream.on('error', reject);
  });
}
