import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { logAudit } from '../utils/audit';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({ err, path: req.path, method: req.method }, 'API Request Error');

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message
    }));
    return res.status(400).json({
      success: false,
      message: 'Validasi data gagal',
      errors: issues
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return res.status(409).json({
        success: false,
        message: `Data dengan nilai tersebut sudah digunakan (${target}).`
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Data yang dicari tidak ditemukan.'
      });
    }
  }

  // Record internal 500 server errors in AuditLog for instant admin visibility
  logAudit(req, 'SERVER_ERROR', 'SYSTEM_ERROR', null, {
    message: err?.message || 'Unknown Server Error',
    name: err?.name,
    code: err?.code,
    stack: typeof err?.stack === 'string' ? err.stack.split('\n').slice(0, 4).join('\n') : undefined,
    path: req.originalUrl || req.path,
    method: req.method
  }).catch(() => {});

  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server internal'
  });
}
