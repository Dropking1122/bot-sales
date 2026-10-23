import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { ALLOWED_IMAGE_TYPES, ALLOWED_EXCEL_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_EXCEL_SIZE_BYTES } from '@bot-sales/shared';
import { AppError } from './errorHandler';

// Ensure upload directories exist
fs.mkdirSync(config.storage.uploadsDir, { recursive: true });
fs.mkdirSync(path.join(config.storage.uploadsDir, 'motorcycles'), { recursive: true });
fs.mkdirSync(path.join(config.storage.uploadsDir, 'imports'), { recursive: true });

// Disk storage for motorcycle images
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(config.storage.uploadsDir, 'motorcycles'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `motor-${uniqueSuffix}${ext}`);
  }
});

// Disk storage for Excel/CSV imports
const importStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(config.storage.uploadsDir, 'imports'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `import-${uniqueSuffix}${ext}`);
  }
});

export const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Format file gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.', 400));
    }
  }
});

export const uploadExcel = multer({
  storage: importStorage,
  limits: { fileSize: MAX_EXCEL_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXCEL_TYPES.includes(file.mimetype) || ext === '.xlsx' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new AppError('Format file tidak didukung. Hanya file .xlsx dan .csv yang diperbolehkan.', 400));
    }
  }
});
