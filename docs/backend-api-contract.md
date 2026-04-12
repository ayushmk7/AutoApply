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

## Metrics Fields

- `queues`: BullMQ counts per queue
- `queue_metrics`: completed/failed/success_rate/avg_duration_ms
- `claude_token_usage_estimate`
- `playwright_success_rate`

