import test from 'node:test';
import assert from 'node:assert/strict';
import { listingDedupeKey, normalizeJobUrl } from './urlNormalize.js';

test('normalizeJobUrl strips tracking params and hash', () => {
  const got = normalizeJobUrl(
    'https://example.com/jobs/123/?utm_source=x&utm_medium=y&gclid=abc#section'
  );
  assert.equal(got, 'https://example.com/jobs/123');
});

test('normalizeJobUrl lowercases host and keeps unsupported scheme unchanged', () => {
  assert.equal(
    normalizeJobUrl('HTTPS://CAREERS.EXAMPLE.COM/Path/?ref=foo'),
    'https://careers.example.com/Path'
  );
  assert.equal(normalizeJobUrl('mailto:test@example.com'), 'mailto:test@example.com');
});

test('listingDedupeKey is stable after url normalization', () => {
  const a = listingDedupeKey(
    'Acme',
    'SWE Intern',
    'https://example.com/jobs/1?utm_campaign=a&utm_content=b'
  );
  const b = listingDedupeKey('acme ', ' swe intern ', 'https://example.com/jobs/1');
  assert.equal(a, b);
});

