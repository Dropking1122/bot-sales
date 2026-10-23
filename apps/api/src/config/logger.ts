import pino from 'pino';
import { config } from './env';

export const logger = pino({
  level: config.env === 'development' ? 'debug' : 'info',
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});
