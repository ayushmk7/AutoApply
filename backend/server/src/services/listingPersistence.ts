import { createHash } from 'crypto';
import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { listingDocumentRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import type { ListingDocument, ListingRecruiterContact, ListingSource } from '../types/listing.js';
import { detectAtsTypeFromUrl } from './atsDetect.js';
import { listingDedupeKey, normalizeJobUrl } from './urlNormalize.js';
import type { ParsedListingRow } from './claude.js';

export function listingIdFromDedupeKey(dedupeKey: string): string {
  return createHash('sha256').update(dedupeKey).digest('hex').slice(0, 40);
}

function parsePostedDate(s: string | null | undefined): unknown {
  if (!s || typeof s !== 'string') {
    return FieldValue.serverTimestamp();
  }
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) {
    return FieldValue.serverTimestamp();
  }
  return Timestamp.fromDate(new Date(ms));
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function rowToListingPayload(
  row: ParsedListingRow,
  source: ListingSource,
  opts: {
    ghost_score: number;
    ghost_reasons: string[];
    urgency_score: number;
    urgency_label: string;
    apollo_contacts?: ListingRecruiterContact[];
    link_health_status?: number | null;
  }
): Omit<ListingDocument, 'id' | 'first_seen' | 'last_seen'> & { dedupe_key: string } {
  const url = normalizeJobUrl(row.url);
  const company = row.company?.trim() || 'Unknown';
  const role = row.role?.trim() || 'Unknown';
  const dedupeKey = listingDedupeKey(company, role, url || row.url);

  return {
    company,
    role,
    location: row.location?.trim() || '',
    url: url || row.url.trim(),
    source,
    description: row.description?.trim() || '',
    posted_date: parsePostedDate(row.posted_date ?? null),
    ghost_score: opts.ghost_score,
    ghost_reasons: opts.ghost_reasons,
    urgency_score: opts.urgency_score,
    urgency_label: opts.urgency_label,
    ats_type: detectAtsTypeFromUrl(url || row.url),
    requires_cover_letter: Boolean(row.requires_cover_letter),
    custom_questions: [],
    active: true,
    dedupe_key: dedupeKey,
    parse_confidence: typeof row.parse_confidence === 'number' ? row.parse_confidence : undefined,
    apollo_contacts: opts.apollo_contacts,
    link_health_status: opts.link_health_status ?? null,
  };
}

/**
 * Phase 5.1 / 5.3 — upsert listing; returns whether the row was newly created.
 */
export async function upsertListingFromParsedRow(
  db: Firestore,
  row: ParsedListingRow,
  source: ListingSource,
  enrichment: {
    ghost_score: number;
    ghost_reasons: string[];
    urgency_score: number;
    urgency_label: string;
    apollo_contacts?: ListingRecruiterContact[];
    link_health_status?: number | null;
  },
  requestId: string
): Promise<{ created: boolean; listingId: string }> {
  const urlRaw = row.url?.trim() || '';
  const url = normalizeJobUrl(urlRaw);
  if (!url || !isValidHttpUrl(url)) {
    logger.debug({ requestId, company: row.company }, 'listing_skip_bad_url');
    return { created: false, listingId: '' };
  }

  const company = row.company?.trim() || 'Unknown';
  const role = row.role?.trim() || 'Unknown';
  const dedupeKey = listingDedupeKey(company, role, url);
  const listingId = listingIdFromDedupeKey(dedupeKey);
  const ref = listingDocumentRef(db, listingId);
  const snap = await ref.get();

  if (snap.exists) {
    const patch: Record<string, unknown> = {
      last_seen: FieldValue.serverTimestamp(),
      active: true,
      url,
    };
    const desc = row.description?.trim();
    if (desc) {
      patch.description = desc;
    }
    await ref.update(patch);
    return { created: false, listingId };
  }

  const base = rowToListingPayload({ ...row, url }, source, enrichment);
  await ref.set({
    id: listingId,
    ...base,
    first_seen: FieldValue.serverTimestamp(),
    last_seen: FieldValue.serverTimestamp(),
  });

  return { created: true, listingId };
}
