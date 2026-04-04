# AutoApply orchestration decision

This records **Phase 0.1** of `docs/06_BACKEND_IMPLEMENTATION_STEPS.md`.

## Choice

We implement workflows as **explicit TypeScript services plus BullMQ jobs** (option **(a)**), not an embedded OpenClaw runtime. Behavior stays aligned with workflow names in `docs/02_TECHNICAL_PRD.md` §2.1 so a future swap to a real OpenClaw engine is mostly mechanical.

## Module and queue naming (1:1 with workflows)

| Technical PRD workflow   | Server-side naming                          |
|--------------------------|---------------------------------------------|
| `scrape_jobs`            | Queue `scrape`, service module `scrape_jobs` |
| `match_and_queue`        | Queue `match`, service module `match_and_queue` |
| `apply_to_job`           | Queue `apply`, service module `apply_to_job` |
| `apply_from_pasted_url`  | Queue `apply_from_pasted_url`, service module `apply_from_pasted_url` |
| `process_response`       | Queue `process_response`, service module `process_response` |
| `onboard_user`           | Service module `onboard_user` (mostly sync HTTP + optional jobs) |
| `interview_loop`         | Service module `interview_loop` (future)   |

Do not duplicate orchestration logic inside Express route handlers beyond thin HTTP mapping; heavy logic lives under `backend/server/src/services/` and is invoked from BullMQ processors or shared helpers.
