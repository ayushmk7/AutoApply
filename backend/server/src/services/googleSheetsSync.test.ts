import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRowVersion, parseSheetStatus } from './googleSheetsSync.js';

test('parseRowVersion sanitizes invalid values', () => {
  assert.equal(parseRowVersion(undefined), 0);
  assert.equal(parseRowVersion(''), 0);
  assert.equal(parseRowVersion('-4'), 0);
  assert.equal(parseRowVersion('3.8'), 3);
  assert.equal(parseRowVersion('12'), 12);
});

test('parseSheetStatus accepts supported statuses only', () => {
  assert.equal(parseSheetStatus('applied'), 'applied');
  assert.equal(parseSheetStatus('manual_needed'), 'manual_needed');
  assert.equal(parseSheetStatus('invalid_status'), undefined);
  assert.equal(parseSheetStatus(''), undefined);
});
