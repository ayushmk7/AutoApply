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

  const data = snap.data() as { agentmail_address?: string };
  if (data.agentmail_address?.trim()) {
    return;
  }

  if (config.mockAgentmail) {
    const mockEmail = `applicant-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@agentmail.mock.local`;
    await ref.update({
      agentmail_address: mockEmail,
      updated_at: FieldValue.serverTimestamp(),
    });
    logger.info({ requestId, uid }, 'agentmail_provision_mock_flag');
    return;
  }

  if (config.nodeEnv !== 'production' && !config.agentmailApiKey) {
    const mockEmail = `applicant-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@agentmail.mock.local`;
    await ref.update({
      agentmail_address: mockEmail,
      updated_at: FieldValue.serverTimestamp(),
    });
    logger.info({ requestId, uid }, 'agentmail_provision_dev_placeholder');
    return;
  }

  if (!config.agentmailApiKey) {
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
        logger.warn(
          { requestId, uid, status: res.status, body: body.slice(0, 200) },
          'agentmail_provision_http_error'
        );
        return;
      }

      const j = (await res.json()) as { email?: string };
      const email = j.email?.trim();
      if (!email) {
        logger.warn({ requestId, uid }, 'agentmail_provision_missing_email_in_response');
        return;
      }

      await ref.update({
        agentmail_address: email,
        updated_at: FieldValue.serverTimestamp(),
      });
      logger.info({ requestId, uid }, 'agentmail_provision_ok');
      return;
    } catch (err) {
      logger.warn({ err, requestId, uid }, 'agentmail_provision_network_error');
      return;
    }
  }

  logger.warn({ requestId, uid }, 'agentmail_provision_exhausted_prefix_retries');
}
