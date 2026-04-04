import { randomUUID } from 'node:crypto';
import { parse } from 'node:url';
import type { WebSocket } from 'ws';
import type { WebSocketServer } from 'ws';
import { config } from '../lib/config.js';
import { verifyDemoToken } from '../lib/demoJwt.js';
import { createFeedSubscriber, FEED_REDIS_CHANNEL } from '../lib/redisFeed.js';
import { getFirebaseAuth, isFirebaseInitialized } from '../lib/firebase.js';
import { logger } from '../lib/logger.js';

const socketsByUid = new Map<string, Set<WebSocket>>();

function trackSocket(uid: string, socket: WebSocket): void {
  let bucket = socketsByUid.get(uid);
  if (!bucket) {
    bucket = new Set();
    socketsByUid.set(uid, bucket);
  }
  bucket.add(socket);
  socket.on('close', () => {
    bucket?.delete(socket);
    if (bucket && bucket.size === 0) {
      socketsByUid.delete(uid);
    }
  });
}

function broadcastToUid(uid: string, raw: string): void {
  const bucket = socketsByUid.get(uid);
  if (!bucket) return;
  for (const s of bucket) {
    if (s.readyState === 1) {
      try {
        s.send(raw);
      } catch (err) {
        logger.warn({ err, uid }, 'feed_ws_send_failed');
      }
    }
  }
}

/**
 * Phase 13.2 — `WS /ws/feed?token=` (Firebase or demo); Redis pub/sub fan-out from workers (Phase 10.7).
 */
export function attachLiveFeedServer(wss: WebSocketServer): void {
  wss.on('connection', async (socket, req) => {
    const handshakeId = randomUUID();
    const parsed = parse(req.url ?? '', true);
    const tokenRaw = parsed.query?.token;
    const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
    if (!token) {
      socket.close(4401, 'missing_token');
      return;
    }

    let uid: string | null = null;
    if (isFirebaseInitialized()) {
      try {
        const decoded = await getFirebaseAuth().verifyIdToken(token, false);
        uid = decoded.uid;
      } catch {
        uid = null;
      }
    }

    const allowDemo = config.nodeEnv !== 'production' || config.enableDemoSkip;
    if (!uid && allowDemo) {
      uid = await verifyDemoToken(token);
    }

    if (!uid) {
      logger.info({ handshakeId }, 'feed_ws_rejected');
      socket.close(4401, 'unauthorized');
      return;
    }

    trackSocket(uid, socket);
    logger.info({ handshakeId, uid }, 'feed_ws_connected');
  });

  const sub = createFeedSubscriber();
  if (!sub) {
    logger.info({}, 'feed_redis_subscriber_disabled');
    return;
  }

  sub.on('error', (err: Error) => logger.warn({ err }, 'feed_redis_sub_error'));
  void sub.subscribe(FEED_REDIS_CHANNEL).catch((err: unknown) => {
    logger.warn({ err }, 'feed_redis_subscribe_failed');
  });
  sub.on('message', (_ch: string, message: string) => {
    try {
      const payload = JSON.parse(String(message)) as { uid?: string; event?: unknown };
      if (!payload.uid) return;
      broadcastToUid(payload.uid, JSON.stringify(payload.event));
    } catch (err) {
      logger.warn({ err }, 'feed_redis_message_invalid');
    }
  });
}
