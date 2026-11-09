import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppConfig } from '../config/index.js';

export type TranscriptionResult = { text: string; language: string | null; durationMs: number };

type PendingRequest = {
  resolve: (result: TranscriptionResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class VoiceTranscriber {
  private child: ChildProcessWithoutNullStreams | null = null;
  private starting: Promise<void> | null = null;
  private ready = false;
  private startError: string | null = null;
  private stdoutBuffer = '';
  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean { return this.config.voiceEnabled; }

  get error(): string | null { return this.startError; }

  async transcribe(audio: Buffer): Promise<TranscriptionResult> {
    if (!this.config.voiceEnabled) throw new Error('Voice parsing nonaktif.');
    await this.ensureStarted();
    const child = this.child;
    if (!child) throw new Error(this.startError || 'Voice worker tidak tersedia.');
    const id = randomUUID();
    const filePath = path.join(tmpdir(), `mynote-voice-${id}.ogg`);
    await fs.writeFile(filePath, audio);
    try {
      return await new Promise<TranscriptionResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('Transkripsi voice timeout.'));
        }, this.config.voiceTimeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify({ id, path: filePath })}\n`);
      });
    } finally {
      await fs.unlink(filePath).catch(() => undefined);
    }
  }

  async close(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.ready = false;
    if (child) {
      try { child.stdin.end(); } catch { /* ignore */ }
      try { child.kill(); } catch { /* ignore */ }
    }
    for (const [, request] of this.pending) {
      clearTimeout(request.timer);
      request.reject(new Error('Voice worker ditutup.'));
    }
    this.pending.clear();
  }

  private async ensureStarted(): Promise<void> {
    if (this.ready) return;
    if (this.startError) throw new Error(this.startError);
    if (this.starting) return this.starting;
    this.starting = this.startWorker().finally(() => { this.starting = null; });
    return this.starting;
  }

  private startWorker(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const args = [
        this.config.voiceScript,
        '--model', this.config.voiceModel,
        '--language', this.config.voiceLanguage,
        '--device', this.config.voiceDevice,
        '--compute-type', this.config.voiceComputeType,
        '--initial-prompt', this.config.voiceInitialPrompt,
        '--hotwords', this.config.voiceHotwords
      ];
      const child = spawn(this.config.voicePython, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      this.child = child;
      this.stdoutBuffer = '';
      let settled = false;
      let readyTimer: ReturnType<typeof setTimeout> | undefined;
      const fail = (message: string): void => {
        if (settled) return;
        settled = true;
        if (readyTimer) clearTimeout(readyTimer);
        this.startError = message;
        this.ready = false;
        this.child = null;
        try { child.kill(); } catch { /* ignore */ }
        reject(new Error(message));
      };
      readyTimer = setTimeout(() => fail('Voice worker tidak siap (timeout memuat model).'), this.config.voiceTimeoutMs);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        this.stdoutBuffer += chunk;
        let newline = this.stdoutBuffer.indexOf('\n');
        while (newline >= 0) {
          const line = this.stdoutBuffer.slice(0, newline).trim();
          this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
          newline = this.stdoutBuffer.indexOf('\n');
          if (!line) continue;
          const payload = parsePayload(line);
          if (!payload) continue;
          if (payload.ready === true) {
            if (!settled) {
              settled = true;
              if (readyTimer) clearTimeout(readyTimer);
              this.ready = true;
              this.startError = null;
              resolve();
            }
            continue;
          }
          if (payload.ready === false) {
            fail(typeof payload.error === 'string' ? payload.error : 'Voice worker gagal dimuat.');
            continue;
          }
          this.handleResponse(payload);
        }
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        if (this.config.logMessageContent) console.error('[voice]', chunk.trim());
      });
      child.on('error', (error) => fail(`Gagal menjalankan Python: ${error.message}`));
      child.on('exit', (code) => {
        this.ready = false;
        this.child = null;
        fail(`Voice worker berhenti (kode ${code ?? 'unknown'}).`);
        for (const [, request] of this.pending) {
          clearTimeout(request.timer);
          request.reject(new Error('Voice worker berhenti.'));
        }
        this.pending.clear();
      });
    });
  }

  private handleResponse(payload: Record<string, unknown>): void {
    const id = typeof payload.id === 'string' ? payload.id : null;
    if (!id) return;
    const request = this.pending.get(id);
    if (!request) return;
    this.pending.delete(id);
    clearTimeout(request.timer);
    if (typeof payload.error === 'string' && payload.error) {
      request.reject(new Error(payload.error));
      return;
    }
    request.resolve({
      text: typeof payload.text === 'string' ? payload.text.trim() : '',
      language: typeof payload.language === 'string' ? payload.language : null,
      durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : 0
    });
  }
}

function parsePayload(line: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(line);
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
