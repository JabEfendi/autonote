import makeWASocket, { useMultiFileAuthState, DisconnectReason, downloadMediaMessage, type WASocket } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { readFile, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../config/index.js';
import type { IncomingMessage, MessageResponder, OutgoingDocument } from './message-adapter.js';

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'logged_out' | 'error';
export type WhatsAppConnectionSnapshot = { status: WhatsAppConnectionStatus; qrDataUrl: string | null; error: string | null };
export type WhatsAppGroup = { groupId: string; groupName: string };

export class BaileysConnectionManager {
  private socket: WASocket | null = null;
  private starting: Promise<void> | null = null;
  private pairingTimer: ReturnType<typeof setTimeout> | null = null;
  private processedIds = new Set<string>();
  private manualDisconnect = false;
  private snapshot: WhatsAppConnectionSnapshot = { status: 'disconnected', qrDataUrl: null, error: null };

  constructor(private readonly config: AppConfig, private readonly onMessage: (message: IncomingMessage) => Promise<unknown>, private readonly onQr?: (qr: string) => void) {
    process.once('exit', () => this.releaseSessionLock());
  }

  getStatus(): WhatsAppConnectionSnapshot { return { ...this.snapshot }; }

  async listGroups(): Promise<WhatsAppGroup[]> {
    if (!this.socket || this.snapshot.status !== 'connected') throw new Error('WhatsApp belum terhubung');
    const groups = await this.socket.groupFetchAllParticipating();
    return Object.values(groups).map((group) => ({ groupId: group.id, groupName: group.subject || group.id })).sort((left, right) => left.groupName.localeCompare(right.groupName));
  }

  async connect(): Promise<void> {
    if (this.snapshot.status === 'connected' || this.snapshot.status === 'connecting') return;
    if (this.starting) return this.starting;
    this.manualDisconnect = false;
    this.starting = this.startSocket().finally(() => { this.starting = null; });
    return this.starting;
  }

  async disconnect(): Promise<void> {
    this.clearPairingTimeout();
    this.manualDisconnect = true;
    const socket = this.socket;
    this.socket = null;
    this.snapshot = { status: 'disconnected', qrDataUrl: null, error: null };
    if (socket) { try { socket.end(undefined); } catch { /* manual disconnect */ } }
    this.releaseSessionLock();
  }

  async resetSession(): Promise<WhatsAppConnectionSnapshot> {
    if (this.starting) { try { await this.starting; } catch { /* ignore failed start */ } }
    await this.disconnect();
    const backupDir = `${this.config.authDir}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      if (existsSync(this.config.authDir)) renameSync(this.config.authDir, backupDir);
    } catch (error) {
      this.snapshot = { status: 'error', qrDataUrl: null, error: error instanceof Error ? `Gagal mencadangkan sesi: ${error.message}` : 'Gagal mencadangkan sesi.' };
      return this.getStatus();
    }
    await this.connect();
    return this.getStatus();
  }

  responder(): MessageResponder {
    return {
      sendText: async (message, text) => { if (!this.socket) throw new Error('WhatsApp is not connected'); await this.socket.sendMessage(message.groupId, { text }); },
      sendDocument: async (message, document) => { if (!this.socket) throw new Error('WhatsApp is not connected'); await sendWhatsAppDocument(this.socket, message, document); }
    };
  }

  private async startSocket(): Promise<void> {
    try {
      this.acquireSessionLock();
    } catch (error) {
      this.snapshot = { status: 'error', qrDataUrl: null, error: error instanceof Error ? error.message : 'Sesi WhatsApp sedang dipakai proses lain.' };
      console.error(`[whatsapp] ${this.snapshot.error}`);
      return;
    }
    this.snapshot = { status: 'connecting', qrDataUrl: null, error: null };
    const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
    const socket = makeWASocket({ auth: state, printQRInTerminal: false });
    this.socket = socket;
    this.startPairingTimeout();
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') { console.log(`[whatsapp] upsert type=${type} count=${messages.length}`); return; }
      for (const message of messages) {
        const groupId = message.key.remoteJid;
        if (!groupId?.endsWith('@g.us') || !message.key.id) { console.log(`[whatsapp] skip jid=${groupId ?? 'none'} id=${message.key.id ?? 'none'}`); continue; }
        if (message.key.fromMe && !this.config.whatsappProcessFromMe) { console.log(`[whatsapp] skip own message id=${message.key.id}`); continue; }
        if (this.processedIds.has(message.key.id)) { console.log(`[whatsapp] skip duplicate id=${message.key.id}`); continue; }
        this.processedIds.add(message.key.id);
        if (this.processedIds.size > 1000) { const oldest = this.processedIds.values().next().value; if (oldest) this.processedIds.delete(oldest); }
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const voice = Boolean(message.message?.audioMessage);
        const keys = message.message ? Object.keys(message.message).join(',') : 'none';
        const tsSeconds = Number(message.messageTimestamp);
        const ageMs = Number.isFinite(tsSeconds) && tsSeconds > 0 ? Date.now() - tsSeconds * 1000 : Number.POSITIVE_INFINITY;
        console.log(`[whatsapp] upsert type=${type} group=${groupId} fromMe=${Boolean(message.key.fromMe)} ageMs=${Math.round(ageMs)} keys=${keys} textLen=${text.length} voice=${voice}`);
        if (!text && !voice) continue;
        if (type === 'append' && ageMs > 2 * 60 * 1000) continue;
        const incoming: IncomingMessage = {
          sourceMessageId: `whatsapp:${message.key.id}`,
          transport: 'whatsapp',
          groupId,
          groupName: groupId,
          senderId: message.key.participant || groupId,
          senderName: message.pushName || '',
          text,
          receivedAt: new Date(Number(message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          voice,
          loadAudio: voice ? async () => downloadMediaMessage(message, 'buffer', {}) : undefined
        };
        console.log(`[whatsapp] message from ${groupId} (${text.length} chars${voice ? ', voice' : ''})`);
        if (this.config.logMessageContent && text) console.log(`[whatsapp] text: ${text}`);
        try {
          await this.onMessage(incoming);
        } catch (error) {
          console.error('[whatsapp] message handling failed:', error instanceof Error ? error.message : error);
        }
      }
    });
    socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.snapshot = { status: 'connecting', qrDataUrl: await QRCode.toDataURL(qr, { margin: 1, width: 300 }), error: null };
        this.onQr?.(qr);
      }
      if (connection === 'open') { this.clearPairingTimeout(); this.snapshot = { status: 'connected', qrDataUrl: null, error: null }; console.log('[whatsapp] connected'); }
      if (connection === 'close') {
        this.clearPairingTimeout();
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        console.log(`[whatsapp] closed (status ${statusCode ?? 'unknown'})`);
        this.socket = null;
        if (statusCode === DisconnectReason.loggedOut) { this.snapshot = { status: 'logged_out', qrDataUrl: null, error: 'Session WhatsApp telah logout.' }; this.releaseSessionLock(); }
        else if (this.manualDisconnect) { this.manualDisconnect = false; this.snapshot = { status: 'disconnected', qrDataUrl: null, error: this.snapshot.error }; }
        else { this.snapshot = { status: 'disconnected', qrDataUrl: null, error: null }; void this.connect(); }
      }
    });
  }

  private startPairingTimeout(): void {
    this.clearPairingTimeout();
    const timer = setTimeout(() => {
      this.pairingTimer = null;
      if (this.snapshot.status !== 'connecting') return;
      console.log('[whatsapp] pairing timeout, stopping connection attempt');
      this.manualDisconnect = true;
      const socket = this.socket;
      this.socket = null;
      this.snapshot = { status: 'disconnected', qrDataUrl: null, error: 'Waktu pairing habis. Klik Connect untuk QR baru.' };
      if (socket) { try { socket.end(undefined); } catch { /* timeout disconnect */ } }
      this.releaseSessionLock();
    }, this.config.whatsappPairingTimeoutMs);
    (timer as unknown as { unref?: () => void }).unref?.();
    this.pairingTimer = timer;
  }

  private clearPairingTimeout(): void {
    if (this.pairingTimer) { clearTimeout(this.pairingTimer); this.pairingTimer = null; }
  }

  private acquireSessionLock(): void {
    mkdirSync(this.config.authDir, { recursive: true });
    const filePath = sessionLockPath(this.config.authDir);
    const pid = readLockPid(filePath);
    if (pid && pid !== process.pid && isProcessAlive(pid)) {
      throw new Error(`Sesi WhatsApp sedang dipakai proses lain (PID ${pid}). Jalankan hanya satu: "npm run web" ATAU "npm run dev".`);
    }
    writeFileSync(filePath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  }

  private releaseSessionLock(): void {
    const filePath = sessionLockPath(this.config.authDir);
    if (readLockPid(filePath) === process.pid) {
      try { unlinkSync(filePath); } catch { /* ignore */ }
    }
  }
}

function sessionLockPath(authDir: string): string { return path.join(authDir, '.session.lock'); }

function readLockPid(filePath: string): number | null {
  try {
    const pid = Number(JSON.parse(readFileSync(filePath, 'utf8')).pid);
    return Number.isFinite(pid) ? pid : null;
  } catch { return null; }
}

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}

async function sendWhatsAppDocument(socket: WASocket, message: IncomingMessage, document: OutgoingDocument): Promise<void> {
  const buffer = await new Promise<Buffer>((resolve, reject) => readFile(document.filePath, (error, data) => error ? reject(error) : resolve(data)));
  await socket.sendMessage(message.groupId, { document: buffer, fileName: document.fileName, mimetype: document.fileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', caption: document.caption });
}
