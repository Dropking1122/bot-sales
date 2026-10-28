import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to current dir

// Secrets must be provided by the environment. Falling back to a literal that is committed to
// this repository turns a public constant into the deployment's signing key / DB password, so a
// missing value is a startup failure instead of a silent downgrade.
const PUBLISHED_SECRETS = ['super_secret_jwt_key_bot_sales_2026_change_in_production'];

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and set it ` +
        `(see README.md). The server refuses to start on a committed default.`
    );
  }
  return value;
}

function requiredSecret(name: string): string {
  const value = required(name);
  if (value.length < 32 || PUBLISHED_SECRETS.includes(value)) {
    throw new Error(
      `${name} must be a private value of at least 32 characters. Generate one with ` +
        `\`openssl rand -hex 32\` and keep it out of version control (see README.md).`
    );
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL'),

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },

  jwt: {
    secret: requiredSecret('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  storage: {
    baseDir: process.env.STORAGE_DIR || path.resolve(__dirname, '../../../storage'),
    uploadsDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../storage/uploads'),
    templatesDir: path.resolve(__dirname, '../../../storage/templates'),
    exportsDir: path.resolve(__dirname, '../../../storage/exports'),
    reportsDir: path.resolve(__dirname, '../../../storage/reports'),
    whatsappSessionDir: process.env.WHATSAPP_SESSION_DIR || path.resolve(__dirname, '../../../storage/whatsapp-session')
  },

  bot: {
    autoReplyEnabled: process.env.WHATSAPP_AUTO_REPLY_ENABLED !== 'false',
    simulationDelayMs: parseInt(process.env.WHATSAPP_SIMULATION_DELAY_MS || '1500', 10),
    timezone: process.env.WHATSAPP_DEFAULT_TIMEZONE || 'Asia/Jakarta'
  }
};
