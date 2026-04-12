import type { Firestore } from 'firebase-admin/firestore';
import { listingDocumentRef, userApplicationsCollection } from '../lib/firestorePaths.js';
import { registrableHostFromUrl } from './distributedRateLimits.js';
import type { ApplicationDocument } from '../types/application.js';
import type { ListingDocument } from '../types/listing.js';

export function extractEmailAddress(raw: string): string {
  const t = raw.trim();
  const m = t.match(/<([^>]+@[^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  const m2 = t.match(/([^\s<>]+@[^\s<>]+)/);
  return (m2?.[1] ?? t).trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const addr = extractEmailAddress(email);
  const at = addr.lastIndexOf('@');
  if (at < 0) return '';
  return addr.slice(at + 1);
}

function listingMatchesFrom(listing: ListingDocument, fromEmail: string, fromDomain: string): boolean {
  const fe = extractEmailAddress(fromEmail);
  for (const c of listing.apollo_contacts ?? []) {
    const em = c.email?.trim();
    if (!em) continue;
    const low = extractEmailAddress(em);
    if (low === fe) return true;
    if (fromDomain && emailDomain(low) === fromDomain) return true;
  }
  try {
    const reg = registrableHostFromUrl(listing.url);
    if (fromDomain && reg && (reg === fromDomain || reg.endsWith('.' + fromDomain))) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function toMillisSafe(v: unknown): number {
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return 0;
}

const ACTIVE_STATUSES: ApplicationDocument['status'][] = [
  'queued',
  'applying',
  'applied',
  'emailed',
  'waiting',
  'interview_scheduled',
  'thank_you_sent',
  'followup_sent',
  'manual_needed',
];

/**
 * Phase 14.2–14.3 — resolve application from sender domain / contacts (thread ambiguity: most recently updated).
 */
export async function matchApplicationForInboundEmail(
  db: Firestore,
  uid: string,
  fromHeader: string
): Promise<string | null> {
  const fromEmail = extractEmailAddress(fromHeader);
  const fromDomain = emailDomain(fromHeader);
  if (!fromEmail) return null;

  const appsSnap = await userApplicationsCollection(db, uid).get();
  const candidates: { id: string; ms: number }[] = [];

  for (const d of appsSnap.docs) {
    const app = { id: d.id, ...(d.data() as object) } as ApplicationDocument;
    if (!ACTIVE_STATUSES.includes(app.status)) continue;

    const listSnap = await listingDocumentRef(db, app.listing_id).get();
    if (!listSnap.exists) continue;
    const listing = { id: listSnap.id, ...(listSnap.data() as object) } as ListingDocument;

    if (listingMatchesFrom(listing, fromEmail, fromDomain)) {
      candidates.push({ id: d.id, ms: toMillisSafe(app.updated_at) || toMillisSafe(app.created_at) });
    }
  }

  if (candidates.length === 0) {
    let best: { id: string; ms: number } | null = null;
    for (const d of appsSnap.docs) {
      const app = { id: d.id, ...(d.data() as object) } as ApplicationDocument;
      if (!ACTIVE_STATUSES.includes(app.status)) continue;
      const ms = toMillisSafe(app.updated_at) || toMillisSafe(app.created_at);
      if (!best || ms > best.ms) {
        best = { id: d.id, ms };
      }
    }
    return best?.id ?? null;
  }

  candidates.sort((a, b) => b.ms - a.ms);
  if (candidates.length > 1) {
    const delta = candidates[0].ms - candidates[1].ms;
    if (delta < 5 * 60 * 1000) {
      // Ambiguous sender-domain match: mark for future UI disambiguation if needed.
      return null;
    }
  }
  return candidates[0].id;
}

export async function findUidByAgentmailRecipient(
  db: Firestore,
  toRaw: string
): Promise<string | null> {
  const normalized = extractEmailAddress(toRaw);
  if (!normalized) return null;

  let snap = await db.collection('users').where('agentmail_address', '==', normalized).limit(2).get();
  if (snap.empty) {
    const mixed = toRaw.trim();
    snap = await db.collection('users').where('agentmail_address', '==', mixed).limit(2).get();
  }
  if (snap.empty) return null;
  if (snap.size > 1) return null;
  return snap.docs[0].id;
}

/** Normalize AgentMail / proxy webhook JSON into canonical fields. */
export function normalizeAgentmailPayload(body: unknown): {
  to: string;
  from: string;
  subject: string;
  body: string;
  messageId?: string;
} | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;

  const pickStr = (...keys: string[]): string => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return '';
  };

  const nested = (o.data ?? o.payload ?? o.message ?? o.email) as Record<string, unknown> | undefined;
  const n = nested && typeof nested === 'object' ? nested : {};

  const to =
    pickStr('to', 'recipient', 'destination', 'inbox') ||
    (typeof n.to === 'string' ? n.to : '') ||
    (typeof (n as { recipient?: string }).recipient === 'string'
      ? (n as { recipient: string }).recipient
      : '');

  const from =
    pickStr('from', 'sender', 'reply_to') ||
    (typeof n.from === 'string' ? n.from : '') ||
    (typeof (n as { sender?: string }).sender === 'string' ? (n as { sender: string }).sender : '');

  const subject = pickStr('subject') || (typeof n.subject === 'string' ? n.subject : '');

  let textBody =
    pickStr('body', 'text', 'plain', 'body_text') ||
    (typeof n.body === 'string' ? n.body : '') ||
    (typeof (n as { text?: string }).text === 'string' ? (n as { text: string }).text : '');

  if (!textBody && typeof o.html === 'string') {
    textBody = o.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const messageId =
    pickStr('id', 'message_id', 'messageId') ||
    (typeof n.id === 'string' ? n.id : '') ||
    undefined;

  if (!to || !from) return null;

  return {
    to: to.trim(),
    from: from.trim(),
    subject: subject.trim() || '(no subject)',
    body: textBody.trim() || '(empty body)',
    messageId: messageId?.trim() || undefined,
  };
}
