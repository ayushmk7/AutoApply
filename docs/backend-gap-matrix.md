# Backend Gap Matrix

This matrix maps current implementation against `docs/06_BACKEND_IMPLEMENTATION_STEPS.md` (Phases 11-20) and records the concrete remaining work.

## Phase Status

| Phase | Requirement | Status | Evidence |
|---|---|---|---|
| 11 | Applications API list/detail/artifacts/retry/manual/notes | Done | `backend/server/src/routes/applications.ts`, `backend/server/src/services/applicationsApi.ts` |
| 12 | Interview loop + calendar + deterministic follow-up behavior | In progress (hardening landed) | `backend/server/src/services/interviewApi.ts`, `backend/server/src/queues/interviewFollowupProcessor.ts` |
| 13 | Feed REST + WS durability | In progress (reconnect + heartbeat landed) | `backend/server/src/services/feedSocket.ts`, `backend/server/src/services/feedApi.ts` |
| 14 | AgentMail outbound/inbound/classify | In progress (retry queue + dedupe/audit hardening) | `backend/server/src/routes/webhooks.ts`, `backend/server/src/services/agentmailProvision.ts` |
| 15 | Sheets sync + conflict handling + OAuth resilience | In progress (bidirectional conflict semantics landed) | `backend/server/src/services/googleSheetsSync.ts`, `backend/server/src/routes/sheets.ts` |
| 16 | Quotas/rate limits/playwright cap | Mostly done | `backend/server/src/services/dailyApplicationRedisQuota.ts`, `backend/server/src/services/distributedRateLimits.ts` |
| 17 | Observability and metrics completeness | In progress (claude apply + queue metrics/readiness expanded) | `backend/server/src/services/workflowMetrics.ts`, `backend/server/src/services/workflowTelemetry.ts` |
| 18 | Testing minimum bar (unit + integration + fixture E2E) | In progress | `backend/server/package.json`, `backend/server/src/services/*.test.ts` |
| 19 | Docker/deploy readiness and health wiring | In progress | `backend/docker-compose.yml`, `backend/server/Dockerfile`, `backend/server/src/routes/health.ts` |
| 20 | Frontend/backend full integration | In progress (dashboard API wiring tranche active) | `frontend/app/components/dashboard/*`, `frontend/app/lib/api.ts` |

## Route Matrix (High-level)

| Route group | Status | Notes |
|---|---|---|
| `/api/auth` | Done | Needs stronger integration tests |
| `/api/profile` | Done | Needs broader tests and docs |
| `/api/jobs` | Partial | API exists; frontend still partly demo-driven |
| `/api/applications` | Partial | interview lifecycle and follow-up scheduling being completed |
| `/api/feed` + `/ws/feed` | Partial | auth and reconnect hardening needed |
| `/api/sheets` | Partial | bidirectional conflict policy and error semantics to finalize |
| `/api/webhooks/agentmail` | Partial | provisioning + retry/audit hardening remains |
| `/api/metrics` | Partial | placeholders being replaced with real telemetry-backed fields |

## Workflow Matrix

| Workflow | Status | Remaining |
|---|---|---|
| `scrape_jobs` | Done | telemetry and tests |
| `match_and_queue` | Done | telemetry and tests |
| `apply_to_job` | Partial | resumability and dead-letter behavior |
| `apply_from_pasted_url` | Partial | richer failure semantics + tests |
| `process_response` | Partial | ambiguity handling and test coverage |
| `interview_loop` | Partial | calendar + delayed follow-up + full lifecycle state |

## Integration Matrix

| Integration | Status | Remaining |
|---|---|---|
| Firebase/Firestore/GCS | Done | integration tests and runbook detail |
| Redis/BullMQ | Done | healthchecks and queue observability docs |
| Claude | Partial | token-usage instrumentation and test doubles |
| Playwright | Partial | rolling success metrics, fixture E2E |
| AgentMail | Partial | provisioning retry queue, stronger dedupe/audit semantics |
| Google Sheets | Partial | bidirectional conflict policy and deleted-sheet recovery docs |
| Google Calendar | Partial | interview event lifecycle and update semantics |
| Apollo | Partial | retry/backoff/freshness metadata |

## Tests Coverage Matrix

| Area | Status |
|---|---|
| Unit (`ssrfGuard`, `latexEscape`) | Partial |
| Unit (`urlNormalize`, `firestoreJson`, interview lifecycle, telemetry) | Missing |
| Integration (`supertest` + auth middleware) | Missing |
| Queue-flow integration tests | Missing |
| Static ATS fixture E2E | Missing |

