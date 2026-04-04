import { Timestamp } from 'firebase-admin/firestore';

/** Serialize Firestore values for JSON responses (Phase 7 HTTP). */
export function jsonSafeFirestore(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    out[k] = jsonSafeValue(v);
  }
  return out;
}

export function jsonSafeValue(v: unknown): unknown {
  if (v instanceof Timestamp) {
    return v.toDate().toISOString();
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return jsonSafeFirestore(v as Record<string, unknown>);
  }
  if (Array.isArray(v)) {
    return v.map((x) => jsonSafeValue(x));
  }
  return v;
}
