import 'dotenv/config';
import path from 'node:path';

const root = process.cwd();
const resolveLocal = (value: string, fallback: string) => path.resolve(root, value || fallback);

export type AppConfig = {
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    max: number;
  };
  authDir: string;
  reportsDir: string;
  timezone: string;
  allowedGroupIds: string[];
  telegramBotToken: string;
  telegramPollIntervalMs: number;
  telegramEnabled: boolean;
  webHost: string;
  webPort: number;
  whatsappPairingTimeoutMs: number;
  whatsappProcessFromMe: boolean;
  defaultCurrency: string;
  logMessageContent: boolean;
  voiceEnabled: boolean;
  voicePython: string;
  voiceScript: string;
  voiceModel: string;
  voiceLanguage: string;
  voiceDevice: string;
  voiceComputeType: string;
  voiceTimeoutMs: number;
  voiceInitialPrompt: string;
  voiceHotwords: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    postgres: {
      host: env.POSTGRES_HOST || '127.0.0.1',
      port: Number(env.POSTGRES_PORT || 5432),
      database: env.POSTGRES_DATABASE || 'mynote',
      user: env.POSTGRES_USER || 'postgres',
      password: env.POSTGRES_PASSWORD || '',
      ssl: env.POSTGRES_SSL === 'true',
      max: Math.min(Math.max(Number(env.POSTGRES_POOL_MAX || 10), 1), 50)
    },
    authDir: resolveLocal(env.AUTH_DIR ?? '', './auth/baileys'),
    reportsDir: resolveLocal(env.REPORTS_DIR ?? '', './reports'),
    timezone: env.TIMEZONE || 'Asia/Jakarta',
    allowedGroupIds: (env.ALLOWED_GROUP_IDS || '').split(',').map((v) => v.trim()).filter(Boolean),
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || '',
    telegramPollIntervalMs: Math.min(Math.max(Number(env.TELEGRAM_POLL_INTERVAL_MS || 1500), 500), 60000),
    telegramEnabled: env.TELEGRAM_ENABLED === 'true' && Boolean(env.TELEGRAM_BOT_TOKEN),
    webHost: env.WEB_HOST || '127.0.0.1',
    webPort: Math.min(Math.max(Number(env.WEB_PORT || 3000), 1), 65535),
    whatsappPairingTimeoutMs: Math.min(Math.max(Number(env.WHATSAPP_PAIRING_TIMEOUT_MS || 120000), 15000), 600000),
    whatsappProcessFromMe: env.WHATSAPP_PROCESS_FROM_ME === 'true',
    defaultCurrency: env.DEFAULT_CURRENCY || 'IDR',
    logMessageContent: env.LOG_MESSAGE_CONTENT === 'true',
    voiceEnabled: env.VOICE_ENABLED === 'true',
    voicePython: env.VOICE_PYTHON && /[\\/]/.test(env.VOICE_PYTHON) ? resolveLocal(env.VOICE_PYTHON, env.VOICE_PYTHON) : (env.VOICE_PYTHON || 'python'),
    voiceScript: resolveLocal(env.VOICE_SCRIPT ?? '', './scripts/voice-worker.py'),
    voiceModel: env.VOICE_MODEL || 'large-v3-turbo',
    voiceLanguage: env.VOICE_LANGUAGE || 'id',
    voiceDevice: env.VOICE_DEVICE || 'cpu',
    voiceComputeType: env.VOICE_COMPUTE_TYPE || 'int8',
    voiceTimeoutMs: Math.min(Math.max(Number(env.VOICE_TIMEOUT_MS || 180000), 10000), 1800000),
    voiceInitialPrompt: env.VOICE_INITIAL_PROMPT ?? 'Catatan bengkel dan garasi. Plat nomor, oli mesin, setoran, borongan, parkir, bengkel. Nominal ditulis angka rupiah.',
    voiceHotwords: env.VOICE_HOTWORDS ?? 'oli mesin, borongan, setoran, parkir, bengkel, plat nomor, pompa solar, besi pipa, BPJS, fee makelar'
  };
}
