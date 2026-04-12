import { randomBytes } from 'crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { config } from '../lib/config.js';
import { userDocumentRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';

/**
 * Phase 4.6 — per-user AgentMail address; collisions retried with new suffix.
 * On API failure, logs for ops (dedicated retry queue can be added with Phase 14).
 */
export async function provisionAgentMailIfNeeded(
  db: Firestore,
  uid: string,
  requestId: string
): Promise<void> {
  const ref = userDocumentRef(db, uid);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data() as {
    agentmail_address?: string;
    agentmail_provision_attempts?: number;
    agentmail_provision_status?: string;
  };
  if (data.agentmail_address?.trim()) {
    return;
  }

  const attempts = Number(data.agentmail_provision_attempts ?? 0);
  const nextAttempts = attempts + 1;

  if (config.mockAgentmail) {
    const mockEmail = `applicant-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@agentmail.mock.local`;
    await ref.update({
      agentmail_address: mockEmail,
      agentmail_provision_attempts: nextAttempts,
      agentmail_provision_status: 'mocked',
      updated_at: FieldValue.serverTimestamp(),
    });
    logger.info({ requestId, uid }, 'agentmail_provision_mock_flag');
    return;
  }

  if (config.nodeEnv !== 'production' && !config.agentmailApiKey) {
    const mockEmail = `applicant-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@agentmail.mock.local`;
    await ref.update({
      agentmail_address: mockEmail,
      agentmail_provision_attempts: nextAttempts,
      agentmail_provision_status: 'mocked_dev',
      updated_at: FieldValue.serverTimestamp(),
    });
    logger.info({ requestId, uid }, 'agentmail_provision_dev_placeholder');
    return;
  }

  if (!config.agentmailApiKey) {
    await ref.set(
      {
        agentmail_provision_attempts: nextAttempts,
        agentmail_provision_status: 'skipped_no_key',
        agentmail_provision_error: 'missing_api_key',
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger.warn({ requestId, uid }, 'agentmail_provision_skipped_no_key');
    return;
  }

  const base = config.agentmailApiBase.replace(/\/$/, '');
  const webhookUrl = `${config.apiBaseUrl.replace(/\/$/, '')}/api/webhooks/agentmail`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix =
      attempt === 0 ? uid.slice(0, 8) : `${uid.slice(0, 6)}_${randomBytes(3).toString('hex')}`;
    try {
      const res = await fetch(`${base}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.agentmailApiKey}`,
        },
        body: JSON.stringify({
          prefix: `applicant-${suffix}`,
          webhook_url: webhookUrl,
        }),
      });

      if (res.status === 409 || res.status === 422) {
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        const code = res.status >= 500 ? 'http_5xx' : `http_${res.status}`;
        await ref.set(
          {
            agentmail_provision_attempts: nextAttempts,
            agentmail_provision_status: res.status >= 500 ? 'retryable_failure' : 'terminal_failure',
            agentmail_provision_error: code,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.warn(
          { requestId, uid, status: res.status, body: body.slice(0, 200) },
          'agentmail_provision_http_error'
        );
        if (res.status >= 500) {
          await ref.set(
            {
              agentmail_provision_retry_after: new Date(
                Date.now() + Math.min(10 * 60_000, 30_000 * nextAttempts)
              ).toISOString(),
            },
            { merge: true }
          );
        }
        return;
      }

      const j = (await res.json()) as { email?: string };
      const email = j.email?.trim();
      if (!email) {
        await ref.set(
          {
            agentmail_provision_attempts: nextAttempts,
            agentmail_provision_status: 'terminal_failure',
            agentmail_provision_error: 'missing_email_in_response',
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.warn({ requestId, uid }, 'agentmail_provision_missing_email_in_response');
        return;
      }

      await ref.update({
        agentmail_address: email,
        agentmail_provision_attempts: nextAttempts,
        agentmail_provision_status: 'ready',
        agentmail_provision_error: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
      });
      logger.info({ requestId, uid }, 'agentmail_provision_ok');
      return;
    } catch (err) {
      await ref.set(
        {
          agentmail_provision_attempts: nextAttempts,
          agentmail_provision_status: 'retryable_failure',
          agentmail_provision_error: 'network_error',
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      logger.warn({ err, requestId, uid }, 'agentmail_provision_network_error');
      return;
    }
  }

  await ref.set(
    {
      agentmail_provision_attempts: nextAttempts,
      agentmail_provision_status: 'terminal_failure',
      agentmail_provision_error: 'exhausted_prefix_retries',
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  logger.warn({ requestId, uid }, 'agentmail_provision_exhausted_prefix_retries');
}
