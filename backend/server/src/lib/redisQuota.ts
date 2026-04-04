import { Redis } from 'ioredis';
import { config } from './config.js';

let client: Redis | null = null;

/**
 * Phase 16 — shared Redis connection for rate limits / semaphores (not BullMQ’s connection).
 */
export function getQuotaRedis(): Redis | null {
  if (!config.redisUrl) return null;
  if (!client) {
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  }
  return client;
}

export function utcDateYmd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function utcHourKey(d = new Date()): string {
  return `${d.toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
}

export function endOfUtcDayMs(d = new Date()): number {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
  return t;
}
