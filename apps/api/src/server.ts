import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/db';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import { authRouter } from './modules/auth/auth.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { brandsRouter } from './modules/brands/brands.routes';
import { motorcyclesRouter } from './modules/motorcycles/motorcycles.routes';
import { financingRouter } from './modules/financing/financing.routes';
import { contactsRouter } from './modules/contacts/contacts.routes';
import { importsRouter } from './modules/imports/import.routes';
import { exportsRouter } from './modules/exports/export.routes';
import { broadcastsRouter } from './modules/broadcasts/broadcast.routes';
import { conversationsRouter } from './modules/conversations/conversations.routes';
import { leadsRouter } from './modules/leads/leads.routes';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes';
import { waManager } from './modules/whatsapp/whatsapp.service';
import { settingsRouter } from './modules/settings/settings.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { auditLogsRouter } from './modules/audit-logs/audit-logs.routes';
import { securityGuard } from './middleware/securityGuard';
import { logAudit } from './utils/audit';

import { startBroadcastWorker } from './jobs/broadcastWorker';

const app = express();

// Settings values are admin-editable and rendered into index.html — escape them.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Security and middleware
app.set('trust proxy', 1);

app.use((_req, res, next) => {
  // Clear any cached HSTS in clients from earlier misconfiguration
  res.setHeader('Strict-Transport-Security', 'max-age=0');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
    hsts: false
  })
);

// CORS: SPA is served by this same server, so only the dealer domain(s) need access.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://m.revd.dev,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin']
  })
);
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Web Application Firewall / Cyber Attack detection
app.use(securityGuard);

// Static files: motorcycle photos only. `uploads/imports` holds customer spreadsheets (PII)
// and must never be web-reachable — it stays behind the authenticated import endpoints.
app.use(
  '/storage/uploads/motorcycles',
  express.static(path.join(config.storage.uploadsDir, 'motorcycles'))
);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/motorcycles', motorcyclesRouter);
app.use('/api/financing', financingRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/broadcasts', broadcastsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit-logs', auditLogsRouter);

// Serve frontend static build if available (disable index: false so app.get('*') injects dynamic DB title)
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath, { index: false }));
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage') || req.path === '/health') {
      return next();
    }

    try {
      const indexPath = path.join(webDistPath, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');

      const titleSetting = await prisma.botSetting.findUnique({ where: { key: 'web_title' } });
      const descSetting = await prisma.botSetting.findUnique({ where: { key: 'web_meta_description' } });

      if (titleSetting?.value) {
        html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(titleSetting.value)}</title>`);
      }
      if (descSetting?.value) {
        html = html.replace(
          /<meta name="description".*?>/,
          `<meta name="description" content="${escapeHtml(descSetting.value)}">`
        );
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.send(html);
    } catch {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(webDistPath, 'index.html'));
    }
  });
}

// Centralized error handler
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  logger.info(`🚀 API Server running on port ${config.port} in ${config.env} mode`);
  // Start background worker for broadcasts
  startBroadcastWorker();
  // Auto-initialize WhatsApp client so QR is ready for admin
  waManager.initialize().catch((err) => {
    logger.warn({ err }, 'WhatsApp initial auto-start encountered issue');
  });
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await waManager.disconnect();
  } catch (e) {
    // ignore
  }
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Closed out remaining connections. Process terminating.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
