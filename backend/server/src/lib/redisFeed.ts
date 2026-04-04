import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';
import type { ApplicationEventWire } from '../types/feedEvent.js';

export const FEED_REDIS_CHANNEL = 'autoapply_feed';

let publisher: Redis | null = null;

function getPublisher(): Redis | null {
  if (!config.redisUrl) return null;
  if (!publisher) {
    publisher = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    publisher.on('error', (err: Error) => logger.warn({ err }, 'redis_feed_publisher_error'));
  }
  return publisher;
}

/**
 * Worker → API fan-out for WebSocket clients (Phase 10.7 / 13).
 */
export async function publishFeedEvent(uid: string, event: ApplicationEventWire): Promise<void> {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(FEED_REDIS_CHANNEL, JSON.stringify({ uid, event }));
  } catch (err) {
    logger.warn({ err, uid }, 'redis_feed_publish_failed');
  }
}

export function createFeedSubscriber(): Redis | null {
  if (!config.redisUrl) return null;
  const sub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  return sub;
}
