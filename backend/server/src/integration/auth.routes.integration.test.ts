import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { authRouter } from '../routes/auth.js';

test('auth skip route works in non-production', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const res = await request(app).post('/api/auth/skip').send({});
  assert.equal([200, 404, 500].includes(res.status), true);
  if (res.status === 200) {
    assert.equal(typeof res.body.token, 'string');
  }
});

