import pino from 'pino';
import { config } from './config.js';

const isDev = config.nodeEnv === 'development';

export const logger = pino({
  level: config.logLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {}),
});
