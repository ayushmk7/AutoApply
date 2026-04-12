import { getQuotaRedis } from '../lib/redisQuota.js';

const PREFIX = 'metrics:v1';
const TTL_SECONDS = 60 * 60 * 24 * 14;

function minuteBucket(date = new Date()): string {
  return date.toISOString().slice(0, 16);
}

function queueKey(scope: string, name: string): string {
  return `${PREFIX}:${scope}:${name}`;
}

async function expireKey(key: string): Promise<void> {
  const redis = getQuotaRedis();
  if (!redis) return;
  await redis.expire(key, TTL_SECONDS).catch(() => {});
}

export async function incrMetricCounter(
  scope: 'queue' | 'claude' | 'playwright',
  name: string,
  field: string,
  by = 1
): Promise<void> {
  const redis = getQuotaRedis();
  if (!redis) return;
  const k = queueKey(scope, name);
  await redis.hincrby(k, field, by).catch(() => {});
  await redis.hset(k, 'updated_at', new Date().toISOString()).catch(() => {});
  await expireKey(k);
}

export async function recordMetricDuration(
  scope: 'queue' | 'playwright',
  name: string,
  durationMs: number
): Promise<void> {
  const redis = getQuotaRedis();
  if (!redis) return;
  const k = queueKey(scope, name);
  const bucket = minuteBucket();
  await redis
    .multi()
    .hincrby(k, 'duration_count', 1)
    .hincrby(k, 'duration_total_ms', Math.max(0, Math.round(durationMs)))
    .hset(k, `bucket:${bucket}`, Math.max(0, Math.round(durationMs)))
    .hset(k, 'updated_at', new Date().toISOString())
    .exec()
    .catch(() => {});
  await expireKey(k);
}

export async function readMetricHash(
  scope: 'queue' | 'claude' | 'playwright',
  name: string
): Promise<Record<string, string>> {
  const redis = getQuotaRedis();
  if (!redis) return {};
  const k = queueKey(scope, name);
  return (await redis.hgetall(k).catch(() => ({}))) ?? {};
}

