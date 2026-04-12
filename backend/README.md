# Backend

Backend services for AutoApply: API server, workflow worker, queue processors, and integrations.

## Run Locally

1. Copy env file:
   - `cp backend/server/.env.example backend/server/.env`
2. Install:
   - `cd backend/server && npm install`
3. Start API:
   - `npm run dev`
4. Start worker:
   - `npm run dev:worker`

With Docker (canonical stack):
- `docker compose up --build`

## Key Endpoints

- `GET /healthz` liveness
- `GET /readyz` readiness (Redis + Firestore checks)
- `GET /api/metrics` workflow metrics (set `METRICS_API_KEY` in production)
- `WS /ws/feed?token=<bearer>` live feed

## Worker Queues

- `scrape`
- `match`
- `apply`
- `apply_from_pasted_url`
- `process_response`
- `interview_followup`

## Operational Notes

- API and worker are separate processes.
- Redis is required for queue processing and delayed jobs.
- Calendar and Sheets share Google OAuth tokens (encrypted at rest).
- AgentMail webhook deliveries are verified and deduplicated.

## Error Codes (examples)

- `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`
- `INVALID_URL`, `UNSUPPORTED_SCHEME`, `SSRF_BLOCKED`, `FETCH_BLOCKED`
- `EXTRACTION_LOW_CONFIDENCE`, `MANUAL_COMPLETION_REQUIRED`
- `SHEETS_SYNC_FAILED`, `SHEETS_NOT_ENABLED`

