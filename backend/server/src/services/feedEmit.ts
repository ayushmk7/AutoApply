import { FieldValue } from 'firebase-admin/firestore';
import { getFirestore } from '../lib/firebase.js';
import { publishFeedEvent } from '../lib/redisFeed.js';
import { userFeedEventsCollection } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import type { ApplicationEventWire, FeedEmitPartial } from '../types/feedEvent.js';

export type FeedEmitContext = {
  company?: string;
  role?: string;
};

function buildWire(
  partial: FeedEmitPartial,
  requestId: string | undefined,
  ctx: FeedEmitContext | undefined
): ApplicationEventWire {
  const ts = new Date().toISOString();
  const metadata: Record<string, unknown> = {};
  if (requestId) metadata.request_id = requestId;
  if (partial.listing_id) metadata.listing_id = partial.listing_id;
  if (partial.code) metadata.code = partial.code;
  if (partial.next_step) metadata.next_step = partial.next_step;

  let action = partial.action;
  if (partial.action === 'error') {
    action = 'failed';
  }

  const detail =
    partial.detail ??
    (partial.code ? String(partial.code) : action.replace(/_/g, ' '));

  return {
    type: 'application_event',
    data: {
      application_id: partial.application_id,
      company: (ctx?.company ?? '').trim() || '—',
      role: (ctx?.role ?? '').trim() || '—',
      action,
      detail,
      timestamp: ts,
      metadata,
    },
  };
}

async function persistFeedEvent(uid: string, wire: ApplicationEventWire): Promise<void> {
  try {
    const db = getFirestore();
    await userFeedEventsCollection(db, uid).add({
      wire,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn({ err, uid }, 'feed_event_persist_failed');
  }
}

/**
 * Phase 10.7 / 13 — PRD wire event, Firestore history (`GET /api/feed`), Redis → WebSocket fan-out.
 */
export async function emitUserFeed(
  uid: string,
  partial: FeedEmitPartial,
  requestId?: string,
  context?: FeedEmitContext
): Promise<void> {
  const wire = buildWire(partial, requestId, context);
  await persistFeedEvent(uid, wire);
  await publishFeedEvent(uid, wire);
}
