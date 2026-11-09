export type LogLevel = 'info' | 'warn' | 'error';

export type LogEntry = {
  id: number;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
};

const MAX_ENTRIES = 400;
const entries: LogEntry[] = [];
let nextId = 1;
let installed = false;
let lineBuffer = '';

function sanitize(value: string): string {
  return value
    .replace(/\b\d{10,15}\b/g, '***')
    .replace(/\s+/g, ' ')
    .trim();
}

function push(level: LogLevel, source: string, message: string): void {
  const text = sanitize(message);
  if (!text) return;
  entries.push({ id: nextId++, time: new Date().toISOString(), level, source, message: text });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

function captureLine(line: string): void {
  const text = line.trim();
  if (!text) return;
  if (text.startsWith('{')) {
    try {
      const payload = JSON.parse(text) as Record<string, unknown>;
      const msg = typeof payload.msg === 'string' ? payload.msg : null;
      if (!msg) return;
      const levelNumber = typeof payload.level === 'number' ? payload.level : 30;
      const level: LogLevel = levelNumber >= 50 ? 'error' : levelNumber >= 40 ? 'warn' : 'info';
      const source = typeof payload.class === 'string' ? payload.class : 'baileys';
      const err = payload.err && typeof payload.err === 'object' && typeof (payload.err as { message?: unknown }).message === 'string'
        ? `: ${(payload.err as { message: string }).message}`
        : '';
      push(level, source, `${msg}${err}`);
      return;
    } catch {
      return;
    }
  }
  const match = text.match(/^\[([a-z0-9_-]+)\]\s*(.*)$/i);
  if (match) {
    const source = match[1].toLowerCase();
    const message = match[2];
    const level: LogLevel = /\b(error|failed|gagal|timeout|closed)\b/i.test(message) ? 'error' : /\b(warn|retry|skip)\b/i.test(message) ? 'warn' : 'info';
    push(level, source, message);
    return;
  }
  if (/\b(error|failed|gagal|timeout)\b/i.test(text)) push('error', 'system', text);
}

function captureChunk(chunk: unknown): void {
  const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  lineBuffer += text;
  if (lineBuffer.length > 20000) lineBuffer = lineBuffer.slice(-20000);
  const lines = lineBuffer.split(/\r?\n/);
  lineBuffer = lines.pop() ?? '';
  for (const line of lines) captureLine(line);
}

export function installLogCapture(): void {
  if (installed) return;
  installed = true;
  const stdout = process.stdout as unknown as { write: (...args: unknown[]) => boolean };
  const stderr = process.stderr as unknown as { write: (...args: unknown[]) => boolean };
  const originalOut = stdout.write.bind(process.stdout) as (...args: unknown[]) => boolean;
  const originalErr = stderr.write.bind(process.stderr) as (...args: unknown[]) => boolean;
  stdout.write = (chunk: unknown, encoding?: unknown, callback?: unknown) => {
    captureChunk(chunk);
    return originalOut(chunk, encoding, callback);
  };
  stderr.write = (chunk: unknown, encoding?: unknown, callback?: unknown) => {
    captureChunk(chunk);
    return originalErr(chunk, encoding, callback);
  };
}

export function listLogs(limit = 200): LogEntry[] {
  const size = Math.min(Math.max(limit, 1), MAX_ENTRIES);
  return entries.slice(-size).reverse();
}

export function clearLogs(): void {
  entries.length = 0;
}
