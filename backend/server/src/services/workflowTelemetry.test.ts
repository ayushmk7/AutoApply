import test from 'node:test';
import assert from 'node:assert/strict';
import { incrMetricCounter, readMetricHash } from './workflowTelemetry.js';

test('workflow telemetry no-ops without redis', async () => {
  await incrMetricCounter('queue', 'apply', 'completed', 1);
  const h = await readMetricHash('queue', 'apply');
  assert.equal(typeof h, 'object');
});

