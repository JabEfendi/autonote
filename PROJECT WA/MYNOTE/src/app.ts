import { loadConfig } from './config/index.js';
import { PostgresRepository } from './persistence/postgres.js';
import { MyNoteServices } from './application/services.js';
import { createMessageProcessor } from './application/process-incoming-message.js';
import { BaileysConnectionManager } from './transport/baileys-client.js';
import { startTelegram } from './transport/telegram-client.js';
import type { IncomingMessage } from './transport/message-adapter.js';
import QRCode from 'qrcode';

const config = loadConfig();
const repository = new PostgresRepository({ ...config.postgres, connectionTimeoutMillis: 10000 });
await repository.initialize();
const services = new MyNoteServices(repository, config);
let whatsapp: BaileysConnectionManager;
let telegram: Awaited<ReturnType<typeof startTelegram>> = null;
const responder = {
  async sendText(message: Parameters<ReturnType<BaileysConnectionManager['responder']>['sendText']>[0], text: string) { await (message.transport === 'telegram' ? telegram : whatsapp.responder())?.sendText(message, text); },
  async sendDocument(message: Parameters<ReturnType<BaileysConnectionManager['responder']>['sendDocument']>[0], document: Parameters<ReturnType<BaileysConnectionManager['responder']>['sendDocument']>[1]) { await (message.transport === 'telegram' ? telegram : whatsapp.responder())?.sendDocument(message, document); }
};
const processor = createMessageProcessor(services, responder);
const handleMessage = async (message: IncomingMessage) => {
  const result = await processor(message);
  console.log(`[processor] ${result.status} group=${message.groupId}`);
  return result;
};
whatsapp = new BaileysConnectionManager(config, handleMessage, (qr) => {
  void QRCode.toString(qr, { type: 'terminal', small: true }).then((text) => console.log(`[whatsapp] scan QR:\n${text}`));
});
await whatsapp.connect();
let lastStatus = '';
setInterval(() => {
  const snapshot = whatsapp.getStatus();
  if (snapshot.status !== lastStatus) {
    lastStatus = snapshot.status;
    console.log(`[whatsapp] status: ${snapshot.status}${snapshot.error ? ` - ${snapshot.error}` : ''}`);
  }
}, 2000);
telegram = await startTelegram(config, handleMessage);
