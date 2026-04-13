# Backend Ops Runbook

## Health and Readiness

- Liveness: `GET /healthz`
- Readiness: `GET /readyz`
- Metrics: `GET /api/metrics` (requires `X-Metrics-Key` if `METRICS_API_KEY` is set)
- Readiness now includes `queue_probe` so API can detect queue access regressions.

## Canonical Local Startup

1. Start infra and services using the canonical stack scripts:
   - root: `npm run dev:stack`
   - backend-only: `npm --prefix backend/server run dev` and `npm --prefix backend/server run dev:worker`
2. Verify health:
   - `GET /healthz` => `status: ok`
   - `GET /readyz` => `status: ok`, `redis: ok`, `queue_probe: ok`
3. Verify metrics auth behavior:
   - with `METRICS_API_KEY` set, unauthenticated `/api/metrics` must return `401`.

## Smoke Execution Notes (Phase 20.9)

- Record the following per run:
  - application IDs, queue IDs, and webhook dedupe keys
  - sheets row IDs and versions
  - feed reconnect window (`since` cursor/timestamp used)
- For WS reconnect:
  - rotate/refresh token client-side
  - reconnect WS
  - call `/api/feed?since=<lastSeenTimestamp>` and verify no missing events
- For blocked URL fallback:
  - capture error code (`FETCH_BLOCKED` or `EXTRACTION_LOW_CONFIDENCE`)
  - rerun with `job_description_text` and verify completion path.

## Rollback / Containment

- Queue instability:
  - pause workers, drain high-risk queues (`apply`, `apply_from_pasted_url`) after snapshotting pending jobs
  - restore from known-good deploy and re-enable workers
- Sheets conflict spike:
  - temporarily disable sheets via `/api/sheets/disable` for affected users
  - preserve `sheets_conflict_state` and `sheets_conflict_reason` for later replay
- AgentMail provisioning failure spike:
  - inspect `agentmail_provision_status`, `agentmail_provision_retry_after`
  - confirm `agentmail_provision_retry` queue is draining before manual intervention.

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

