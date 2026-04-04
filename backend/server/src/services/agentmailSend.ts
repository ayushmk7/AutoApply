import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS_BYTES = 18 * 1024 * 1024;

export interface AgentMailAttachment {
  filename: string;
  contentType: string;
  /** Raw bytes; encoded base64 on the wire. */
  content: Buffer;
}

export interface SendOutboundEmailInput {
  inboxId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  requestId: string;
  idempotencyKey?: string;
  /** Phase 14.1 — PDFs as base64 per `docs/03_BACKEND_PRD.md` §7.2. */
  attachments?: AgentMailAttachment[];
}

/**
 * Phase 12 / 14 — outbound send via AgentMail HTTP API (`docs/03_BACKEND_PRD.md`).
 */
export async function sendAgentMailOutbound(
  input: SendOutboundEmailInput
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  if (config.mockAgentmail) {
    logger.info({ requestId: input.requestId, to: input.to }, 'agentmail_send_mock');
    return { ok: true, messageId: `mock-${input.requestId}` };
  }

  if (!config.agentmailApiKey) {
    if (config.nodeEnv !== 'production') {
      logger.info({ requestId: input.requestId }, 'agentmail_send_skipped_dev_no_key');
      return { ok: true, messageId: `dev-skip-${input.requestId}` };
    }
    return { ok: false, error: 'AGENTMAIL_API_KEY is not configured' };
  }

  let totalAtt = 0;
  const wireAttachments: { filename: string; content: string; content_type: string }[] = [];
  if (input.attachments?.length) {
    for (const a of input.attachments) {
      if (a.content.length > MAX_ATTACHMENT_BYTES) {
        return { ok: false, error: 'attachment_too_large' };
      }
      totalAtt += a.content.length;
      if (totalAtt > MAX_TOTAL_ATTACHMENTS_BYTES) {
        return { ok: false, error: 'attachments_total_too_large' };
      }
      wireAttachments.push({
        filename: a.filename,
        content: a.content.toString('base64'),
        content_type: a.contentType,
      });
    }
  }

  const base = config.agentmailApiBase.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.agentmailApiKey}`,
  };
  if (input.idempotencyKey) {
    headers['Idempotency-Key'] = input.idempotencyKey;
  }

  const body = JSON.stringify({
    inbox_id: input.inboxId,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(wireAttachments.length ? { attachments: wireAttachments } : {}),
  });

  try {
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers,
      body,
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn(
        { requestId: input.requestId, status: res.status, body: t.slice(0, 300) },
        'agentmail_send_http_error'
      );
      return { ok: false, error: `agentmail_http_${res.status}` };
    }

    const j = (await res.json()) as { id?: string; message_id?: string };
    const messageId = j.id ?? j.message_id;
    return { ok: true, messageId };
  } catch (err) {
    logger.warn({ err, requestId: input.requestId }, 'agentmail_send_network_error');
    return { ok: false, error: 'agentmail_network_error' };
  }
}
