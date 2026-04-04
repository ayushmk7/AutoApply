import type { ConnectionOptions } from 'bullmq';
import { config } from '../lib/config.js';

export function getBullConnection(): ConnectionOptions {
  if (!config.redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }
  return { url: config.redisUrl };
}
