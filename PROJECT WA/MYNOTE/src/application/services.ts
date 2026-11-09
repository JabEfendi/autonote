import type { AppConfig } from '../config/index.js';
import { parseRecordMessage } from '../domain/parser/record-parser.js';
import { exportOperationalWorkbook } from '../reporting/operational-workbook.js';
import { exportLedgerPdf } from '../reporting/ledger-pdf.js';
import { PostgresRepository } from '../persistence/postgres.js';
import { parseLedgerMessage, type LedgerParseResult } from '../domain/parser/ledger-parser.js';
import { VoiceTranscriber, type TranscriptionResult } from '../transport/voice-transcriber.js';

export class MyNoteServices {
  private readonly transcriber: VoiceTranscriber;
  constructor(readonly repository: PostgresRepository, readonly config: AppConfig) {
    this.transcriber = new VoiceTranscriber(config);
  }
  transcribeVoice(audio: Buffer): Promise<TranscriptionResult> { return this.transcriber.transcribe(audio); }
  async validateMessage(text: string) {
    const formats = await this.repository.listCommandFormats();
    const normalized = formats.reduce((value, format) => value.replace(new RegExp(`^${escapeRegExp(format.command)}(?=\\s|$)`, 'i'), format.targetCommand), text.trim());
    return parseRecordMessage(normalized, this.config.defaultCurrency);
  }
  parseLedgerMessage(text: string): LedgerParseResult { return parseLedgerMessage(text); }
  listRecords(filters: Parameters<PostgresRepository['listRecords']>[0]) { return this.repository.listRecords(filters); }
  summary(from: string, to: string, groupId?: string) { return this.repository.getSummary(from, to, groupId); }
  async generateReport(format: 'pdf' | 'xlsx', from: string, to: string, _groupId?: string) { const report = await this.repository.getDailyCashReport(from, to); const filePath = format === 'pdf' ? await exportLedgerPdf(this.config.reportsDir, report) : await exportOperationalWorkbook(this.config.reportsDir, report); return { format, fileName: filePath.split(/[\\/]/).pop()!, filePath, recordCount: report.rows.length, createdAt: new Date().toISOString() }; }
  async health() { return { ...(await this.repository.health()), whatsappConnectionState: 'not_started', reportsDirectory: this.config.reportsDir }; }
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
