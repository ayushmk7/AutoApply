# Backend API Contract (Operational)

This complements `docs/openapi.yaml` with runtime and workflow semantics.

## Auth

- All protected endpoints expect `Authorization: Bearer <token>`.
- Accepts Firebase ID token; demo token accepted only in allowed environments.

## Error Shape

```json
{ "error": "string", "code": "OPTIONAL_CODE", "details": {} }
```

## Workflow-oriented Status Codes

- `FETCH_BLOCKED`
- `EXTRACTION_LOW_CONFIDENCE`
- `SSRF_BLOCKED`
- `INVALID_URL`
- `UNSUPPORTED_SCHEME`
- `MANUAL_COMPLETION_REQUIRED`
- `SHEETS_SYNC_FAILED`
- `SHEETS_CONFLICT`
- `WEBHOOK_UNAUTHORIZED`

## Feed Events

Wire type:

```json
{
  "type": "application_event",
  "data": {
    "application_id": "optional",
    "company": "string",
    "role": "string",
    "action": "string",
    "detail": "string",
    "timestamp": "ISO",
    "metadata": {}
  }
}
```

Reconnect contract:
- WS auth failures close the socket with `4401` (`unauthorized`).
- Client reconnects with a fresh bearer token and SHOULD call `GET /api/feed?since=<lastTimestamp>` to recover missed events.
- Server emits heartbeat frames (`{ "type": "heartbeat", ... }`) and responds to client `ping` with `pong`.

## Interview Follow-Up Lifecycle

- Follow-up state fields on applications:
  - `followup_state`: `none | scheduled | cancelled | sent | skipped_response_received | skipped_state_conflict`
  - `followup_due_at`
  - `followup_cancel_reason`
  - `followup_audit[]`
- Any inbound recruiter response (`process_response`) cancels scheduled follow-up jobs.

## Sheets Bidirectional Conflict Semantics

- Sheet row columns now include:
  - `Application ID`
  - `Row Version`
  - `Last Writer`
  - `Conflict State`
  - `Conflict Reason`
- Sync policy:
  - Firestore writes increment `sheets_row_version`.
  - Sheet edits are only applied when `row_version > firestore_version`.
  - Stale sheet writes mark application conflict state (`sheet_version_stale`).

## Metrics Fields

- `queues`: BullMQ counts per queue
- `queue_metrics`: completed/failed/success_rate/avg_duration_ms
- `claude_token_usage_estimate`
- `playwright_success_rate`

