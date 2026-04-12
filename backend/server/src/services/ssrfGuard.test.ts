import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertUrlSafeForFetch } from './ssrfGuard.js';
import { HttpError } from '../lib/httpError.js';

describe('assertUrlSafeForFetch', () => {
  it('rejects loopback IPv4 literal', async () => {
    await assert.rejects(
      () => assertUrlSafeForFetch('http://127.0.0.1/secret'),
      (e: unknown) => e instanceof HttpError && e.code === 'SSRF_BLOCKED'
    );
  });

  it('rejects non-http schemes', async () => {
    await assert.rejects(
      () => assertUrlSafeForFetch('file:///etc/passwd'),
      (e: unknown) => e instanceof HttpError && e.code === 'UNSUPPORTED_SCHEME'
    );
  });

  it('rejects metadata ip literal', async () => {
    await assert.rejects(
      () => assertUrlSafeForFetch('http://169.254.169.254/latest/meta-data'),
      (e: unknown) => e instanceof HttpError && e.code === 'SSRF_BLOCKED'
    );
  });

  it('rejects localhost hostname', async () => {
    await assert.rejects(
      () => assertUrlSafeForFetch('http://localhost:8080'),
      (e: unknown) => e instanceof HttpError && e.code === 'SSRF_BLOCKED'
    );
  });
});
