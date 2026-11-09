import type { AppConfig } from '../config/index.js';
import type { IncomingMessage, MessageResponder, OutgoingDocument } from './message-adapter.js';
import { readFile } from 'node:fs';

type TelegramUpdate = { update_id: number; message?: { message_id: number; date: number; text?: string; chat: { id: number; title?: string; type: string }; from?: { id: number; first_name?: string; last_name?: string } } };

export async function startTelegram(config: AppConfig, onMessage: (message: IncomingMessage) => Promise<unknown>): Promise<MessageResponder | null> {
  if (!config.telegramEnabled) return null;
  let offset = 0;
  let running = true;
  const api = (method: string) => `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
  const request = async <T>(method: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(api(method), init);
    if (!response.ok) throw new Error(`Telegram API ${method} failed: ${response.status}`);
    const body = await response.json() as { ok: boolean; result: T; description?: string };
    if (!body.ok) throw new Error(body.description || `Telegram API ${method} failed`);
    return body.result;
  };
  const responder: MessageResponder = {
    async sendText(message, text) { await request('sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: message.groupId, text }) }); },
    async sendDocument(message, document) {
      const data = new FormData();
      data.append('chat_id', message.groupId);
      data.append('caption', document.caption || '');
      const file = await new Promise<Buffer>((resolve, reject) => readFile(document.filePath, (error, data) => error ? reject(error) : resolve(data)));
      const bytes = new ArrayBuffer(file.byteLength);
      new Uint8Array(bytes).set(file);
      data.append('document', new Blob([bytes]), document.fileName);
      await request('sendDocument', { method: 'POST', body: data });
    }
  };
  const poll = async (): Promise<void> => {
    while (running) {
      try {
        const updates = await request<TelegramUpdate[]>('getUpdates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offset, timeout: 20, allowed_updates: ['message'] }) });
        for (const update of updates) {
          offset = update.update_id + 1;
          const source = update.message;
          if (!source?.text || !source.chat || !source.from || source.chat.type === 'private') continue;
          const senderName = [source.from.first_name, source.from.last_name].filter(Boolean).join(' ');
          await onMessage({ sourceMessageId: `telegram:${update.update_id}:${source.message_id}`, transport: 'telegram', groupId: String(source.chat.id), groupName: source.chat.title || String(source.chat.id), senderId: String(source.from.id), senderName, text: source.text, receivedAt: new Date(source.date * 1000).toISOString() });
        }
      } catch (error) {
        console.error('Telegram polling failed:', error instanceof Error ? error.message : 'unknown error');
        await new Promise((resolve) => setTimeout(resolve, config.telegramPollIntervalMs));
      }
    }
  };
  void poll();
  return responder;
}
