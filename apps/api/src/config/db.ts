import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

// @ts-ignore
prisma.$on('error', (e) => {
  logger.error({ err: e }, 'Prisma Database Error');
});

// @ts-ignore
prisma.$on('warn', (e) => {
  logger.warn({ warn: e }, 'Prisma Database Warning');
});
