import { getEnv } from '../utils/get-env';

const envConfig = () => ({
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: getEnv('PORT', '3000'),

  BASE_PATH: getEnv('BASE_PATH', '/api'),
  DATABASE_URL: getEnv('DATABASE_URL', ''),
  API_PUBLIC_URL: getEnv('API_PUBLIC_URL', 'http://localhost:3000'),
  CLIENT_URL: getEnv('CLIENT_URL', 'http://localhost:5173'),

  JWT_SECRET: getEnv('JWT_SECRET', 'secert_jwt'),
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '1d'),

  LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),

  AWS_ACCESS_KEY: getEnv('AWS_ACCESS_KEY'),
  AWS_SECRET_KEY: getEnv('AWS_SECRET_KEY'),
  AWS_REGION: getEnv('AWS_REGION'),
  AWS_S3_BUCKET: getEnv('AWS_S3_BUCKET'),

  GOOGLE_CLIENT_ID: getEnv('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: getEnv('GOOGLE_CLIENT_SECRET', ''),
  GOOGLE_REDIRECT_URI: getEnv(
    'GOOGLE_REDIRECT_URI',
    'http://localhost:3000/api/storage-accounts/google/callback',
  ),

  TELEGRAM_API_ID: getEnv('TELEGRAM_API_ID', ''),
  TELEGRAM_API_HASH: getEnv('TELEGRAM_API_HASH', ''),

  ENCRYPTION_KEY: getEnv(
    'ENCRYPTION_KEY',
    'filestorage_local_encryption_key_change_me',
  ),
  ADMIN_EMAIL: getEnv('ADMIN_EMAIL', 'demo@example.com'),

  // Disk temp directory for resumable/streaming upload jobs (multer diskStorage).
  UPLOAD_TMP_DIR: getEnv('UPLOAD_TMP_DIR', ''),
  // Per-worker upload concurrency (global cap across all accounts).
  UPLOAD_WORKER_CONCURRENCY: getEnv('UPLOAD_WORKER_CONCURRENCY', '4'),

  // Fixed-window rate limit for the public v1 API (requests per key per minute).
  API_RATE_LIMIT_PER_MIN: getEnv('API_RATE_LIMIT_PER_MIN', '120'),

  LOGTAIL_SOURCE_TOKEN: getEnv('LOGTAIL_SOURCE_TOKEN'),
  LOGTAIL_INGESTING_HOST: getEnv('LOGTAIL_INGESTING_HOST'),

  ALLOWED_ORIGINS: getEnv(
    'ALLOWED_ORIGINS',
    'https://cloudnest.vercel.app',
  ),

  // ---- AI (Phase 3). Keys are server-side only and never sent to the client. ----
  // Provider is any OpenAI-compatible endpoint (OpenAI, Groq, Together, Ollama, ...).
  AI_ENABLED: getEnv('AI_ENABLED', 'false'),
  AI_PROVIDER: getEnv('AI_PROVIDER', 'openai'),
  AI_API_KEY: getEnv('AI_API_KEY', ''),
  AI_BASE_URL: getEnv('AI_BASE_URL', 'https://api.openai.com/v1'),
  AI_MODEL: getEnv('AI_MODEL', 'gpt-4o-mini'),
  AI_VISION_MODEL: getEnv('AI_VISION_MODEL', 'gpt-4o-mini'),
  AI_EMBEDDING_MODEL: getEnv('AI_EMBEDDING_MODEL', 'text-embedding-3-small'),
  AI_MAX_OUTPUT_TOKENS: getEnv('AI_MAX_OUTPUT_TOKENS', '1024'),

  // ---- Transactional email (Phase 7). ----
  // SMTP settings are stored in the database at runtime and take priority.
  // These env values are a fallback so email works before an admin configures SMTP.
  SMTP_HOST: getEnv('SMTP_HOST', ''),
  SMTP_PORT: getEnv('SMTP_PORT', '587'),
  SMTP_SECURE: getEnv('SMTP_SECURE', 'false'),
  SMTP_USERNAME: getEnv('SMTP_USERNAME', ''),
  SMTP_PASSWORD: getEnv('SMTP_PASSWORD', ''),
  SMTP_FROM_NAME: getEnv('SMTP_FROM_NAME', 'CloudNest'),
  SMTP_FROM_ADDRESS: getEnv('SMTP_FROM_ADDRESS', ''),
  SMTP_REPLY_TO: getEnv('SMTP_REPLY_TO', ''),

  // How long a signup OTP / password-reset / magic link stays valid, in minutes.
  OTP_TTL_MINUTES: getEnv('OTP_TTL_MINUTES', '15'),
  MAGIC_LINK_TTL_MINUTES: getEnv('MAGIC_LINK_TTL_MINUTES', '15'),
  PASSWORD_RESET_TTL_MINUTES: getEnv('PASSWORD_RESET_TTL_MINUTES', '30'),
  SUPPORT_EMAIL: getEnv('SUPPORT_EMAIL', ''),
});

export const Env = envConfig();
