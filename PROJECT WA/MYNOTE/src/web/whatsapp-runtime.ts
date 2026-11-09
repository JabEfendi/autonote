import { BaileysConnectionManager } from '../transport/baileys-client.js';
import { createMessageProcessor } from '../application/process-incoming-message.js';
import type { MyNoteServices } from '../application/services.js';
import type { MessageResponder } from '../transport/message-adapter.js';
import type { AppConfig } from '../config/index.js';

export function createWhatsAppRuntime(config: AppConfig, services: MyNoteServices): BaileysConnectionManager {
  let manager: BaileysConnectionManager;
  manager = new BaileysConnectionManager(config, async (message) => createMessageProcessor(services, manager.responder())(message));
  return manager;
}
