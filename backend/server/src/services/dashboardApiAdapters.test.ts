import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSheetStatus, parseRowVersion } from './googleSheetsSync.js';

function toUiStatus(status: string): string {
  if (status === 'manual_needed') return 'manual_needed';
  if (status === 'offer' || status === 'accepted') return 'offer';
  if (status.startsWith('rejected')) return 'rejected';
  if (status === 'interview_scheduled' || status === 'thank_you_sent' || status === 'followup_sent') {
    return 'interview';
  }
  if (status === 'waiting') return 'waiting';
  if (status === 'queued' || status === 'applying' || status === 'applied' || status === 'emailed') {
    return 'applied';
  }
  return 'other';
}

test('ui status normalization covers backend statuses', () => {
  assert.equal(toUiStatus('queued'), 'applied');
  assert.equal(toUiStatus('interview_scheduled'), 'interview');
  assert.equal(toUiStatus('followup_sent'), 'interview');
  assert.equal(toUiStatus('rejected_auto'), 'rejected');
  assert.equal(toUiStatus('offer'), 'offer');
  assert.equal(toUiStatus('manual_needed'), 'manual_needed');
});

test('sheet conflict parser alignment with status normalization', () => {
  assert.equal(parseRowVersion('7'), 7);
  assert.equal(parseSheetStatus('rejected_review'), 'rejected_review');
  assert.equal(toUiStatus(parseSheetStatus('rejected_review') ?? ''), 'rejected');
});
