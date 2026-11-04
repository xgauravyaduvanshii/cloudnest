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

  LOGTAIL_SOURCE_TOKEN: getEnv('LOGTAIL_SOURCE_TOKEN'),
  LOGTAIL_INGESTING_HOST: getEnv('LOGTAIL_INGESTING_HOST'),

  ALLOWED_ORIGINS: getEnv(
    'ALLOWED_ORIGINS',
    'https://cloudnest.vercel.app',
  ),
});

export const Env = envConfig();
