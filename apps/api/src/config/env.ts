import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to current dir

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  databaseUrl: process.env.DATABASE_URL || 'postgresql://bot_sales_user:BotSalesSecurePass2026!@localhost:5432/bot_sales_db?schema=public',

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_jwt_key_bot_sales_2026_change_in_production',
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
