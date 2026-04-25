/**
 * src/config/logger.ts
 *
 * Winston logger configuration.
 * - In production: JSON format (machine-parseable, Render log aggregation friendly)
 * - In development: colorized, human-readable console output
 */

import winston from 'winston';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev
    ? combine(colorize(), timestamp({ format: 'HH:mm:ss' }), simple())
    : combine(timestamp(), errors({ stack: true }), json()),
  defaultMeta: { service: 'postly-api' },
  transports: [
    new winston.transports.Console(),
    // In production, consider adding a File or external transport here
  ],
});

// Convenience export so callers can do: import { logger } from '@/config/logger'
export default logger;
