export type TransportKind = 'whatsapp' | 'telegram';

export type IncomingMessage = {
  sourceMessageId: string;
  transport: TransportKind;
  groupId: string;
  groupName: string;
  senderId: string;
  senderName: string;
  text: string;
  receivedAt: string;
  voice?: boolean;
  loadAudio?: () => Promise<Buffer>;
};

export type OutgoingDocument = { filePath: string; fileName: string; caption?: string };

export type MessageResponder = {
  sendText(message: IncomingMessage, text: string): Promise<void>;
  sendDocument(message: IncomingMessage, document: OutgoingDocument): Promise<void>;
};

export function isAllowedGroup(message: IncomingMessage, allowedGroupIds: string[]): boolean { return allowedGroupIds.includes(message.groupId); }
