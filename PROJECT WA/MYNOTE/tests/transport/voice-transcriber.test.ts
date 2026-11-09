import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/index.js';
import { VoiceTranscriber } from '../../src/transport/voice-transcriber.js';

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/fake-voice-worker.mjs');

describe('voice transcriber', () => {
  it('reports disabled when VOICE_ENABLED is not set', () => {
    expect(new VoiceTranscriber(loadConfig({})).enabled).toBe(false);
  });

  it('transcribes through the worker protocol', async () => {
    const config = loadConfig({ VOICE_ENABLED: 'true', VOICE_PYTHON: process.execPath, VOICE_SCRIPT: fixture, VOICE_MODEL: 'fake', VOICE_TIMEOUT_MS: '10000' });
    const transcriber = new VoiceTranscriber(config);
    try {
      const result = await transcriber.transcribe(Buffer.from('fake audio'));
      expect(result.text).toBe('halo dunia');
      expect(result.language).toBe('id');
      expect(result.durationMs).toBe(1234);
    } finally {
      await transcriber.close();
    }
  });
});
