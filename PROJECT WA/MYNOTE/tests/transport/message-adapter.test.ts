import { describe, expect, it } from 'vitest';
import { isAllowedGroup, type IncomingMessage } from '../../src/transport/message-adapter.js';

const message: IncomingMessage = {
  sourceMessageId: 'whatsapp:message-1', transport: 'whatsapp', groupId: '120@g.us', groupName: 'Test', senderId: '1', senderName: 'Tester', text: '#catat', receivedAt: '2026-11-04T00:00:00.000Z'
};

describe('message authorization', () => {
  it('allows only explicitly configured chat ids', () => {
    expect(isAllowedGroup(message, ['120@g.us'])).toBe(true);
    expect(isAllowedGroup(message, ['999@g.us'])).toBe(false);
  });
});
