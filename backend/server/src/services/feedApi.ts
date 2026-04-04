import { type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userFeedEventsCollection } from '../lib/firestorePaths.js';
import { jsonSafeValue } from './firestoreJson.js';
import type { ApplicationEventWire } from '../types/feedEvent.js';

export const feedListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

export type FeedListQuery = z.infer<typeof feedListQuerySchema>;

interface FeedDoc {
  wire?: ApplicationEventWire;
  created_at?: unknown;
}

export type FeedHistoryRow = ApplicationEventWire & { id: string; created_at?: unknown };

/**
 * Phase 13.1 — REST feed history (newest first); cap page size per implementation doc.
 */
export async function listUserFeedPage(
  db: Firestore,
  uid: string,
  query: FeedListQuery
): Promise<{ events: FeedHistoryRow[]; next_cursor: string | null }> {
  const col = userFeedEventsCollection(db, uid);
  const fetchLimit = query.limit + 1;

  let q = col.orderBy('created_at', 'desc').limit(fetchLimit);

  if (query.cursor?.trim()) {
    const curSnap = await col.doc(query.cursor.trim()).get();
    if (curSnap.exists) {
      q = col.orderBy('created_at', 'desc').startAfter(curSnap).limit(fetchLimit);
    }
  }

  const snap = await q.get();
  return shapeFeedDocs(snap.docs, query.limit);
}

function shapeFeedDocs(
  docs: QueryDocumentSnapshot[],
  pageLimit: number
): { events: FeedHistoryRow[]; next_cursor: string | null } {
  const hasMore = docs.length > pageLimit;
  const pageDocs = hasMore ? docs.slice(0, pageLimit) : docs;

  const events: FeedHistoryRow[] = [];
  for (const d of pageDocs) {
    const data = d.data() as FeedDoc;
    if (data.wire?.type === 'application_event') {
      events.push({
        ...data.wire,
        id: d.id,
        created_at: jsonSafeValue(data.created_at),
      });
    }
  }

  const last = pageDocs[pageDocs.length - 1];
  const next_cursor = hasMore && last ? last.id : null;
  return { events, next_cursor };
}
