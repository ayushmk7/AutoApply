import type { RequestHandler } from 'express';
import { Router } from 'express';
import { getFirestore, isFirebaseInitialized } from '../lib/firebase.js';
import { getRedisHealth } from '../lib/redisHealth.js';
import { config } from '../lib/config.js';
import { getQueue } from '../queues/producers.js';
import { QUEUE_NAMES } from '../queues/names.js';

export const healthzHandler: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' });
};

export const readyzHandler: RequestHandler = async (_req, res, next) => {
  try {
    const redis = await getRedisHealth();
    let firestore: 'ok' | 'skipped' | 'error' = 'skipped';
    if (isFirebaseInitialized()) {
      try {
        await getFirestore().doc('_healthz/ping').get();
        firestore = 'ok';
      } catch {
        firestore = 'error';
      }
    }
    let queueProbe: 'ok' | 'skipped' | 'error' = 'skipped';
    if (config.redisUrl) {
      try {
        await getQueue(QUEUE_NAMES.apply).getJobCounts();
        queueProbe = 'ok';
      } catch {
        queueProbe = 'error';
      }
    }
    const degraded = redis !== 'ok' || firestore === 'error' || queueProbe === 'error';
    if (degraded) {
      res.status(503).json({
        status: 'not_ready',
        redis,
        firestore,
        queue_probe: queueProbe,
      });
      return;
    }
    res.status(200).json({
      status: 'ok',
      redis,
      firestore,
      queue_probe: queueProbe,
    });
  } catch (err) {
    next(err);
  }
};

export const healthRouter = Router();

/** Backward-compatible aggregate health (always 200). */
healthRouter.get('/', async (_req, res) => {
  const redis = await getRedisHealth();
  let firestore: 'ok' | 'skipped' | 'error' = 'skipped';
  if (isFirebaseInitialized()) {
    try {
      await getFirestore().doc('_healthz/ping').get();
      firestore = 'ok';
    } catch {
      firestore = 'error';
    }
  }
  let queueProbe: 'ok' | 'skipped' | 'error' = 'skipped';
  if (config.redisUrl) {
    try {
      await getQueue(QUEUE_NAMES.apply).getJobCounts();
      queueProbe = 'ok';
    } catch {
      queueProbe = 'error';
    }
  }
  const degraded = redis !== 'ok' || firestore === 'error' || queueProbe === 'error';
  res.status(200).json({
    status: degraded ? 'degraded' : 'ok',
    redis,
    firestore,
    queue_probe: queueProbe,
  });
});
