import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBearerToken } from './auth.js';

test('parseBearerToken parses valid bearer token', () => {
  const req = { headers: { authorization: 'Bearer abc.def' } } as any;
  assert.equal(parseBearerToken(req), 'abc.def');
});

test('parseBearerToken rejects malformed auth header', () => {
  const req = { headers: { authorization: 'Basic xyz' } } as any;
  assert.equal(parseBearerToken(req), null);
});

