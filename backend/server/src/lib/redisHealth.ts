import { Redis } from 'ioredis';
import { config } from './config.js';

export type RedisHealth = 'ok' | 'down' | 'not_configured';

export async function getRedisHealth(): Promise<RedisHealth> {
  if (!config.redisUrl) return 'not_configured';
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2500,
    retryStrategy: () => null,
  });
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : 'down';
  } catch {
    return 'down';
  } finally {
    redis.disconnect();
  }
}
