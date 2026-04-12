# Backend Ops Runbook

## Health and Readiness

- Liveness: `GET /healthz`
- Readiness: `GET /readyz`
- Metrics: `GET /api/metrics` (requires `X-Metrics-Key` if `METRICS_API_KEY` is set)

## Common Incidents

### Queue Backlog Growth

1. Check `/api/metrics` -> `queues` and `queue_metrics`.
2. Confirm worker process is running (`npm run worker` or compose worker service).
3. Check Redis health and connectivity.

### AgentMail Webhook Failures

1. Verify `AGENTMAIL_WEBHOOK_SECRET`.
2. Confirm route receives raw body for signature verification.
3. Inspect dedupe and audit documents:
   - `agentmail_webhook_dedupe`
   - `ops_webhook_audit`

### Calendar / Sheets Failures

1. Check user token state and `sheets_sync_error`.
2. Re-run sheets full sync via `/api/sheets/sync`.
3. Confirm OAuth redirect URL and client credentials.

### Apply Pipeline Manual Fallbacks

1. Inspect application status and `manual_reason`.
2. Check feed events and latest worker logs by request ID.
3. Confirm Playwright dependencies and ATS domain rate limits.

## Production Guards

- Set `METRICS_API_KEY`.
- Keep `MOCK_AGENTMAIL` and `MOCK_CLASSIFY_INBOUND_EMAIL` disabled.
- Use strong `TOKEN_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET`.
- Run API and worker separately.

