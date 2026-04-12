import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { jsonSafeFirestore, jsonSafeValue } from './firestoreJson.js';

test('jsonSafeValue converts Firestore Timestamp to ISO', () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  const got = jsonSafeValue(ts);
  assert.equal(got, ts.toDate().toISOString());
});

test('jsonSafeFirestore recursively converts nested structures', () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  const got = jsonSafeFirestore({
    created_at: ts,
    nested: { updated_at: ts },
    arr: [ts, { when: ts }],
  });
  assert.deepEqual(got, {
    created_at: ts.toDate().toISOString(),
    nested: { updated_at: ts.toDate().toISOString() },
    arr: [ts.toDate().toISOString(), { when: ts.toDate().toISOString() }],
  });
});

