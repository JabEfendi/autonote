import type { MyNoteServices } from './services.js';
import { isAllowedGroup, type IncomingMessage } from '../transport/message-adapter.js';
import type { MessageResponder } from '../transport/message-adapter.js';
import { parseReportCommand, parseRulesCommand } from '../domain/parser/report-parser.js';
import { getReportRange } from '../domain/periods.js';

const RULES_TEXT = [
  'MYNOTE - PANDUAN',
  '',
  'CATAT TERSTRUKTUR:',
  '#catat',
  'tanggal: DD/MM/YYYY',
  'jenis: pemasukan|pengeluaran',
  'kategori: teks',
  'keterangan: teks',
  'nominal: angka',
  '',
  'CATAT NATURAL (contoh):',
  'BH 8520 AO',
  'Oli mesin 2 liter 130rb',
  '',
  'KONTRAK MUAT:',
  'BH 8520 AO',
  'Muat Jakarta - Medan',
  '31 juta borongan 17 juta',
  '',
  'TAGIHAN MUAT:',
  'BH 8520 AO',
  'Tagihan muat Jakarta - Medan',
  '9 juta',
  '',
  'TRANSFER:',
  'Pindahan antar kas 500rb',
  '',
  'NOMINAL: 250000, 130rb, 3,15 juta, 6 juta',
  '',
  'MINTA LAPORAN: !laporan hari ini|minggu ini|bulan ini (mengirim Excel dan PDF)',
  '',
  'VOICE: kirim voice note berisi catatan (butuh VOICE_ENABLED)'
].join('\n');

export function createMessageProcessor(services: MyNoteServices, responder?: MessageResponder) {
  return async (message: IncomingMessage) => {
    if (!await services.repository.isAllowedGroup(message.groupId, services.config.allowedGroupIds)) return { status: 'ignored' as const };
    const rejectVoice = async (reason: string) => {
      const stored = await services.repository.saveMessage(message, undefined, reason);
      if (!stored) return { status: 'duplicate' as const };
      if (responder) await responder.sendText(message, reason);
      return { status: 'voice_failed' as const };
    };
    if (message.voice) {
      if (!services.config.voiceEnabled) return rejectVoice('Voice parsing belum aktif. Kirim sebagai teks atau aktifkan VOICE_ENABLED.');
      if (!message.loadAudio) return rejectVoice('Voice tidak dapat dibaca. Coba kirim ulang atau ketik manual.');
      try {
        if (responder) await responder.sendText(message, 'Voice diterima, sedang ditranskripsi...');
        const result = await services.transcribeVoice(await message.loadAudio());
        message.text = result.text;
        if (!result.text.trim()) return rejectVoice('Voice tidak dapat ditranskripsi. Coba kirim ulang atau ketik manual.');
      } catch (error) {
        console.error('[voice] transcription failed:', error instanceof Error ? error.message : error);
        return rejectVoice('Voice gagal ditranskripsi. Coba kirim ulang atau ketik manual.');
      }
    }
    if (parseRulesCommand(message.text)) {
      if (responder) await responder.sendText(message, RULES_TEXT);
      return { status: 'rules_sent' as const };
    }
    const report = parseReportCommand(message.text);
    const parsed = report ? null : await services.validateMessage(message.text);
    const ledger = report || parsed?.valid ? null : services.parseLedgerMessage(message.text);
    if (ledger?.valid && ledger.transaction) {
      ledger.transaction.sourceMessageId = message.sourceMessageId;
      const ledgerId = await services.repository.saveLedgerTransaction(ledger.transaction);
      if (!ledgerId) return { status: 'duplicate' as const };
      if (responder) await responder.sendText(message, `Transaksi tercatat: ${ledger.transaction.category} ${ledger.transaction.incomeAmount || ledger.transaction.expenseAmount} IDR${message.voice ? ' (voice)' : ''}`);
      return { status: 'ledger_processed' as const, ledger, ledgerId };
    }
    const stored = await services.repository.saveMessage(message, parsed?.valid ? parsed.record : undefined, report || parsed?.valid ? undefined : parsed?.errors.join('; '));
    if (!stored) return { status: 'duplicate' as const };
    if (report) {
      const range = getReportRange(report.period);
      if (report.format === 'both') {
        const excel = await services.generateReport('xlsx', range.from, range.to, message.groupId);
        const pdf = await services.generateReport('pdf', range.from, range.to, message.groupId);
        if (responder) {
          await responder.sendDocument(message, { filePath: excel.filePath, fileName: excel.fileName, caption: `Laporan ${report.period} (Excel)` });
          await responder.sendDocument(message, { filePath: pdf.filePath, fileName: pdf.fileName, caption: `Laporan ${report.period} (PDF)` });
        }
        return { status: 'report' as const, generated: { excel, pdf } };
      }
      const generated = await services.generateReport(report.format, range.from, range.to, message.groupId);
      if (responder) await responder.sendDocument(message, { filePath: generated.filePath, fileName: generated.fileName, caption: `Laporan ${report.period}` });
      return { status: 'report' as const, generated };
    }
    if (!parsed?.valid) {
      if (responder) await responder.sendText(message, `Catatan belum disimpan. Perbaiki: ${parsed?.errors.join('; ') || 'format perintah tidak dikenali'}`);
      return { status: 'failed' as const, parsed };
    }
    const record = parsed.record;
    if (!record) throw new Error('Parser returned valid result without a record');
    if (responder) await responder.sendText(message, `Catatan tersimpan: ${record.category} ${record.amountMinor} ${record.currency}${message.voice ? ' (voice)' : ''}`);
    return { status: 'processed' as const, parsed };
  };
}
