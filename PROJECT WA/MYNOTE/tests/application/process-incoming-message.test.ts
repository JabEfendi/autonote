import { describe, expect, it } from 'vitest';
import { createMessageProcessor } from '../../src/application/process-incoming-message.js';
import type { MyNoteServices } from '../../src/application/services.js';
import type { IncomingMessage, MessageResponder } from '../../src/transport/message-adapter.js';

type Options = { allowed?: boolean; voiceEnabled?: boolean; transcript?: string };

function makeServices(options: Options = {}): { services: MyNoteServices; replies: string[] } {
  const replies: string[] = [];
  const services = {
    config: { voiceEnabled: options.voiceEnabled ?? true, allowedGroupIds: [] },
    repository: {
      isAllowedGroup: async () => options.allowed ?? true,
      saveMessage: async () => true
    },
    validateMessage: async () => ({ valid: false, errors: [] }),
    parseLedgerMessage: () => ({ valid: false }),
    generateReport: async () => { throw new Error('not used'); },
    transcribeVoice: async () => ({ text: options.transcript ?? '', language: 'id', durationMs: 1000 })
  } as unknown as MyNoteServices;
  return { services, replies };
}

function makeResponder(replies: string[]): MessageResponder {
  return {
    sendText: async (_message: IncomingMessage, text: string) => { replies.push(text); },
    sendDocument: async () => undefined
  };
}

const base: Omit<IncomingMessage, 'text'> = {
  sourceMessageId: 'whatsapp:voice-1',
  transport: 'whatsapp',
  groupId: '120363430603431644@g.us',
  groupName: 'Mynote',
  senderId: 'sender',
  senderName: 'tester',
  receivedAt: new Date().toISOString(),
  voice: true
};

function voiceMessage(transcript: string): IncomingMessage {
  return { ...base, text: '', loadAudio: async () => Buffer.from('audio') };
}

describe('process incoming voice message', () => {
  it('asks for a retry when transcription is empty', async () => {
    const { services, replies } = makeServices({ transcript: '' });
    const result = await createMessageProcessor(services, makeResponder(replies))(voiceMessage(''));
    expect(result.status).toBe('voice_failed');
    expect(replies[0]).toContain('sedang ditranskripsi');
    expect(replies[1]).toContain('Voice tidak dapat ditranskripsi');
  });

  it('explains that voice parsing is disabled', async () => {
    const { services, replies } = makeServices({ voiceEnabled: false });
    const result = await createMessageProcessor(services, makeResponder(replies))(voiceMessage(''));
    expect(result.status).toBe('voice_failed');
    expect(replies[0]).toContain('Voice parsing belum aktif');
  });

  it('processes the transcript as a command', async () => {
    const { services, replies } = makeServices({ transcript: '!rules' });
    const result = await createMessageProcessor(services, makeResponder(replies))(voiceMessage('!rules'));
    expect(result.status).toBe('rules_sent');
    expect(replies[0]).toContain('sedang ditranskripsi');
    expect(replies[1]).toContain('MYNOTE - PANDUAN');
  });

  it('ignores voice from unauthorized groups', async () => {
    const { services, replies } = makeServices({ allowed: false, transcript: '!rules' });
    const result = await createMessageProcessor(services, makeResponder(replies))(voiceMessage('!rules'));
    expect(result.status).toBe('ignored');
    expect(replies).toHaveLength(0);
  });
});
