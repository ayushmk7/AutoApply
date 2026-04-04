# AutoApply — Backend Implementation Steps (End-to-End)

This document is a **sequential implementation guide** for building the AutoApply backend described in `docs/03_BACKEND_PRD.md`, `docs/01_GENERAL_PRD.md`, and `docs/02_TECHNICAL_PRD.md`. It is meant to be executed in order: each phase depends on earlier foundations, and **edge cases** called out here should be designed in from the start—not bolted on later.

The **last section** covers **unifying the frontend and backend** into a single runnable product (dev and production).

**Related docs:** `docs/04_CLAUDE_CODE_GUIDE.md` (suggested Claude Code session order), `docs/05_FRONTEND_PROMPT.md` (UI contract expectations).

---

## How to use this file

1. Complete phases in order unless a note says “can parallelize.”
2. For each API route or worker, implement **happy path first**, then the **edge cases** listed under that step.
3. Keep **TypeScript types** aligned with `docs/02_TECHNICAL_PRD.md` §7 (Profile, Listing, Application).
4. Treat **“Apply from link”** (URL intake + optional pasted JD) as a **first-class workflow** with the same artifacts and statuses as queue-based applications.

---

## Phase 0 — Decisions, accounts, and local tooling

### Step 0.1 — Fix stack and hosting assumptions

- **Runtime:** Node.js 20+, TypeScript, Express.
- **Data:** Firebase Auth (client) + Firebase Admin (server) + Firestore + GCS.
- **Async work:** BullMQ + Redis.
- **Browser automation:** Playwright (headless Chromium), ideally in Docker with sufficient RAM (2GB+ per concurrent browser context is a practical planning number).
- **Orchestration:** PRDs reference OpenClaw workflows. **Decide now:** either (a) implement workflows as **explicit TypeScript services + BullMQ jobs** (recommended for a small team), or (b) embed a real OpenClaw runtime. The steps below assume **(a)** but map 1:1 to workflow names in the technical PRD.

**Edge cases**

- If OpenClaw is deferred, **name modules** after workflows (`scrape_jobs`, `apply_to_job`, `apply_from_pasted_url`, `process_response`, etc.) so a future swap is mechanical.
- Document the decision in the repo root or team notes so implementers do not duplicate orchestration logic in routes.

### Step 0.2 — Create third-party accounts and keys

Provision and securely store (password manager / secret manager):

| Service | Purpose |
|--------|---------|
| Firebase project | Auth + Firestore + (optional) client SDK config |
| GCS bucket | CVs, PDFs, screenshots, cover letters |
| Anthropic | Claude API |
| AgentMail | Per-user agent addresses, outbound send, inbound webhook |
| Apollo.io | Recruiter enrichment (rate limits vary by plan) |
| GitHub | PAT for listing repo scraping |
| Google Cloud OAuth client | Sheets + Calendar scopes |
| 2Captcha | CAPTCHA solving |
| Redis host | BullMQ |

**Edge cases**

- **Missing keys in dev:** support feature flags (e.g. skip real AgentMail, use mock classify) *only* behind `NODE_ENV !== 'production'` and explicit env toggles—never silent failure in prod.
- **Key rotation:** webhook secrets and API keys should be reloadable via deploy, not baked into images.

### Step 0.3 — Local development prerequisites

- Docker (for API + worker + Redis + Playwright + texlive parity).
- Firebase **Emulators** optional but recommended for Firestore/Auth without touching prod.
- `gcloud` CLI optional (for GCS bucket setup scripts).

---

## Phase 1 — Repository layout and TypeScript project

### Step 1.1 — Directory structure

Create a backend package (e.g. `server/` or `backend/`) with:

- `src/server.ts` — HTTP + WebSocket bootstrap
- `src/worker.ts` — BullMQ worker entry (separate process in prod)
- `src/routes/` — Express routers per domain
- `src/middleware/` — auth, rate limit, error handler, upload limits
- `src/services/` — business logic (no raw Express in heavy logic)
- `src/queues/` — queue definitions, job payloads, producers
- `src/playwright/` — manager, adapters, captcha helpers
- `src/templates/` — LaTeX templates
- `src/types/` — shared interfaces matching technical PRD models
- `src/lib/` — firebase-admin init, logging, config parsing

**Edge cases**

- **Monorepo vs split repo:** If the frontend stays at repo root, avoid ambiguous `import` paths; use workspace packages or clear `tsconfig` paths.
- **Single `dist/`:** ensure worker and server both compile and share types without circular imports.

### Step 1.2 — Configuration module

Centralize env validation (e.g. Zod or envalid):

- Fail fast on startup if required prod vars are missing.
- Normalize `FIREBASE_PRIVATE_KEY` newlines (`\n` in env).

**Edge cases**

- `API_BASE_URL` and `FRONTEND_URL` wrong → OAuth redirects and webhook URLs break; validate URL shape.
- `REDIS_URL` transient failures → health check should report degraded, not crash loop silently.

### Step 1.3 — Logging and request IDs

- Structured JSON logs in production.
- Attach `x-request-id` or generate UUID per request; propagate to BullMQ job data for traceability.

---

## Phase 2 — Firebase Admin, Firestore, and GCS

### Step 2.1 — Initialize Firebase Admin

As in `docs/03_BACKEND_PRD.md` §2.2: initialize with service account; export `auth`, `db`, `storage`.

**Edge cases**

- **Emulator mode:** when `FIRESTORE_EMULATOR_HOST` is set, point Admin SDK at emulators.
- **Credential loading:** support JSON file path *or* base64/json inline for cloud hosts.

### Step 2.2 — Firestore data layout (canonical)

Align with PRDs:

- `users/{uid}` — profile document (nested `cv`, `questionnaire`, `preferences`, `agentmail_address`, timestamps).
- `users/{uid}/applications/{appId}` — per-user applications (as in technical PRD §7.3).
- `listings/{listingId}` — global scraped listings; **backend-only writes** via Admin SDK.

**Edge cases**

- **Subcollection vs root:** PRD shows applications under user; implement queries accordingly (collection group queries if you ever need admin dashboards).
- **Large documents:** CV JSON can grow; avoid hitting Firestore’s document size limits—store overflow in GCS if needed.
- **Timestamps:** use `FieldValue.serverTimestamp()` for `created_at` / `updated_at` consistency.

### Step 2.3 — Security rules (client safety net)

Deploy rules from `docs/03_BACKEND_PRD.md` §2.5. Remember: **Admin SDK bypasses rules**; rules protect accidental client SDK usage.

**Edge cases**

- If the frontend ever uses client Firestore reads, rules must match actual paths; otherwise keep client off Firestore for listings.

### Step 2.4 — Google Cloud Storage

- Bucket for `users/{uid}/cv/original.{ext}`, resumes, screenshots, cover letters.
- Uniform bucket-level access; IAM for service account.
- **Signed URLs** (time-limited) for client download of PDFs/images—avoid making buckets public.

**Edge cases**

- **Content-Type** and **virus scanning:** for a demo, optional; for production, consider ClamAV or cloud scanner + reject on fail.
- **Lifecycle rules:** PRD suggests auto-delete screenshots older than 90 days—implement as bucket lifecycle JSON.
- **Unicode filenames:** sanitize object names; use application IDs in paths, not raw titles.

---

## Phase 3 — Authentication and identity

### Step 3.1 — `requireAuth` middleware

Implement Bearer Firebase ID token verification; attach `uid` and `email` to `AuthRequest`.

**Edge cases**

- Malformed `Authorization` header (missing Bearer, extra spaces).
- **Clock skew:** rare verify failures; NTP on servers.
- **Revoked tokens:** `checkRevoked: true` optional; trades latency for security—document choice.
- **Custom tokens for demo:** if using `POST /api/auth/skip`, use a **distinct** verification path (see below)—do not weaken Firebase middleware.

### Step 3.2 — `POST /api/auth/register`

- **Auth:** Firebase token required.
- **Body:** `{ email }` (verify matches token email when present).
- **Action:** create user doc if missing; idempotent if already exists.

**Edge cases**

- Race: two parallel registers → use transaction or `create` with catch `ALREADY_EXISTS`.
- Email missing on some providers → allow but log; store what Firebase provides.

### Step 3.3 — `POST /api/auth/skip` (demo mode)

- **Auth:** none.
- **Response:** `{ demo_uid, token }` per PRD.

**Edge cases**

- **Security:** demo JWT (or opaque token) must be **short-lived** (e.g. 24h max), **signed**, and **scoped** (read-only demo data or isolated demo namespace). Never treat demo tokens as equivalent to Firebase UID in production collections unless data is synthetic only.
- **Abuse:** strict rate limit by IP; captcha optional.
- **Data:** seed demo listings/applications in Firestore or in-memory **per demo session**—avoid polluting real user space.

### Step 3.4 — Optional role / admin

If you add internal admin routes later, use **custom claims** via Admin SDK—do not trust client-supplied roles.

---

## Phase 4 — Profile APIs

### Step 4.1 — `GET/PUT /api/profile`

- Load and update questionnaire, preferences, basic identity fields.

**Edge cases**

- **Partial updates:** use deep merge carefully; prefer explicit PATCH semantics for nested objects.
- **Validation:** enforce enums (`resume_template`, numeric thresholds with min/max).

### Step 4.2 — `POST /api/profile/cv` (multipart)

Pipeline:

1. Validate file type (PDF, DOCX) and size cap (e.g. 10–15MB).
2. Stream to GCS `users/{uid}/cv/original.{ext}`.
3. Extract text: `pdftotext` for PDF; `pandoc` or mammoth-like path for DOCX.
4. Call Claude to produce structured CV JSON.
5. Persist to `profile.cv`; return parsed JSON for UI review.

**Edge cases**

- **Scanned PDFs (image-only):** OCR path or return error with actionable message.
- **Corrupt PDF/DOCX:** catch parse errors; 400 with code `CV_PARSE_FAILED`.
- **PII logging:** never log raw CV text in production logs.
- **Concurrent uploads:** last-write-wins; consider versioning `cv_upload_id` for applications referencing a snapshot.

### Step 4.3 — `PUT /api/profile/cv`

User corrections after parse—validate schema before write.

**Edge cases**

- Reject unknown fields or strip them consistently.
- Size limits on bullet arrays to avoid document bloat.

### Step 4.4 — `POST /api/profile/linkedin` (CSV)

Parse CSV; normalize company names (Claude); store in `preferences.linkedin_connections`.

**Edge cases**

- **Wrong CSV format:** detect missing columns; return 400 with expected header sample.
- **Encoding:** UTF-8 with BOM strip.
- **Huge files:** row count cap; stream parse.

### Step 4.5 — `PUT /api/profile/preferences`

Thresholds, toggles, template.

**Edge cases**

- `daily_limit` 0 or negative → reject.
- `auto_apply_threshold` outside 0–100 → reject.

### Step 4.6 — AgentMail address provisioning (onboarding hook)

When profile reaches “ready” state, create per-user agent email (see Phase 12) and store on user doc.

**Edge cases**

- AgentMail downtime → retry queue; block only if you must send mail before first apply.
- **Unique prefix collisions:** handle API error and retry with new suffix.

---

## Phase 5 — Job listings pipeline (scraped sources)

### Step 5.1 — Listing model in Firestore

Implement `listings/{id}` per technical PRD §7.2: `source`, URLs, description, ghost fields, ATS hints, `active` flag.

**Edge cases**

- **Deduping:** same job on multiple repos—hash on normalized `(company, role, url)` or URL canonicalization.
- **URL normalization:** strip tracking params; handle `http` vs `https`.

### Step 5.2 — GitHub fetch + change detection

Per technical PRD §4.1: use token; store last commit SHA per repo; skip unchanged.

**Edge cases**

- **Rate limit:** backoff; exponential retry; surface degraded status in `/api/jobs/stats` if stale.
- **Repo renamed/moved:** configurable repo list; alert on 404.
- **Partial markdown:** Claude parse anyway; record `parse_confidence` if you add metadata.

### Step 5.3 — `scrape` queue job

BullMQ queue `scrape` concurrency 1 (PRD): fetch → parse → diff → store.

**Edge cases**

- **Job timeout:** GitHub or Claude hangs → BullMQ `timeout`; mark run failed with last good state.
- **Poison message:** malformed payload → DLQ or dead-letter collection in Firestore for ops.

### Step 5.4 — Ghost detection and urgency

Implement `ghost_score` / reasons (Claude + optional Playwright link health).

**Edge cases**

- **False positives:** allow user override on job card (store `user_ghost_override` if product requires).
- **Rate limit link checks:** batch and cache per domain.

### Step 5.5 — Apollo enrichment (optional per listing batch)

Fetch recruiter contacts by company; respect Apollo plan limits.

**Edge cases**

- No results → omit silently; do not fail scrape job.
- GDPR / consent copy is a product concern; store only what PRD allows.

### Step 5.6 — Cron trigger

Railway cron, Cloud Scheduler, or worker with repeatable job—every 2–4 hours per general PRD.

---

## Phase 6 — Matching and queuing

### Step 6.1 — `match` queue

For new listings, compute fit score via Claude; referral match against LinkedIn connections.

**Edge cases**

- **User without profile:** skip match or use defaults.
- **Token budget:** batch listings; truncate descriptions with summarization step if needed.

### Step 6.2 — Auto-apply vs manual approval

Respect `preferences.auto_apply_threshold` and `daily_limit`.

**Edge cases**

- **Timezone boundaries** for “per 24 hours”—use user timezone if stored, else UTC; document behavior.
- **Referral-first pause:** if product requires pausing when referral path exists, enforce before enqueueing `apply`.

---

## Phase 7 — Jobs HTTP API

### Step 7.1 — `GET /api/jobs`

Query params from PRD: `source`, `company`, `location`, `min_fit_score`, `max_ghost_score`, `status`, `has_referral`, `sort_by`, `page`, `limit`.

**Edge cases**

- **Composite indexes:** Firestore requires indexes for compound filters—plan queries or filter in memory for small demos (document scalability limit).
- **Pagination:** cursor-based preferred for live datasets; offset OK for demo scale.
- **Join user status:** merge application status from `users/{uid}/applications` by `listing_id`.

### Step 7.2 — `GET /api/jobs/:id`

Return listing + user-specific application row if any.

**Edge cases**

- Wrong ID → 404.
- Listing deactivated → still return with `active: false` for historical applications.

### Step 7.3 — `POST /api/jobs/:id/approve` and `POST /api/jobs/:id/skip`

- Approve → enqueue apply job or mark queued.
- Skip → persist user decision to avoid re-surfacing.

**Edge cases**

- Double approve → idempotent.
- Listing removed → 410 or 404 with clear code.

### Step 7.4 — `GET /api/jobs/stats`

Aggregates for dashboard: scraped counts, ghosts, etc.

**Edge cases**

- Expensive counts: precompute in `scrape` job into a `stats/global` doc.

---

## Phase 8 — Apply workflow (core) — resumes, ATS, documents

Implement services callable from BullMQ `apply` queue. Map steps to `apply_to_job` in technical PRD §2.1.

### Step 8.1 — `analyze_job`

Claude extracts skills, custom question prompts, cover letter requirement, etc.

**Edge cases**

- **Very short JD:** low confidence → flag `needs_manual_review` on application.
- **Non-English JD:** detect language; either proceed or return bilingual error—product decision.

### Step 8.2 — `generate_resume` + template injection

Use LaTeX templates (`docs/03_BACKEND_PRD.md` §5).

**Edge cases**

- **Hallucination control:** run validation pass (technical PRD §6 prompts) comparing bullets to CV JSON; fail closed into “user review required” if mismatch.
- **Special characters:** sanitization pass for LaTeX reserved chars.

### Step 8.3 — `compile_resume` (pdflatex)

Docker image includes texlive + poppler.

**Edge cases**

- Compile failure sequence: compile → sanitize → Claude fix → still fail → `manual_needed` with logs stored in GCS (not in logs).
- **Timeouts:** kill long-running `pdflatex`.

### Step 8.4 — ATS scoring

`pdftotext` + keyword logic + Claude for suggestions.

**Edge cases**

- **Score threshold:** default 70%; max 2 revision loops (PRD)—enforce in code to prevent infinite loops.
- **Missing pdf text:** treat as low parsability; suggest template change.

### Step 8.5 — Cover letter generation (conditional)

If listing requires or heuristics say yes—generate and optionally compile to PDF.

**Edge cases**

- **Redundancy:** prompt must avoid repeating resume verbatim (general PRD).

### Step 8.6 — Custom answers map

From questionnaire + essays.

**Edge cases**

- **Low confidence answers:** flag in API response for UI review before submit.
- **Over-length answers:** enforce character limits per question where ATS typically truncates.

### Step 8.7 — Persist application record + GCS artifacts

Update `users/{uid}/applications/{id}` with URLs (signed URL generation at read time or store gs:// paths).

**Edge cases**

- Partial failure after GCS upload → transactional cleanup or orphan GC job.

---

## Phase 9 — Playwright submission pipeline

### Step 9.1 — Playwright manager

Singleton browser; bounded contexts (PRD §6).

**Edge cases**

- **Max contexts:** queue backpressure instead of unbounded spawn.
- **Process crash:** restart browser; mark in-flight applications `unknown` and allow retry.

### Step 9.2 — ATS detection

Implement detector per technical PRD §5.2.

**Edge cases**

- **Shortened URLs:** resolve redirects before detect; cache final URL.
- **Multi-domain careers:** subdomain rules.

### Step 9.3 — Adapters: Greenhouse, Lever, SmartRecruiters, iCIMS

Implement `ATSAdapter` interface (technical PRD §5.3).

**Edge cases**

- **DOM changes:** version adapters; capture HTML snippet on failure for debugging (store in GCS restricted path).
- **File upload inputs:** handle `input[type=file]` visibility and Playwright `setInputFiles`.

### Step 9.4 — Workday

PRD marks Workday as partial / manual—detect and short-circuit to `manual_needed` with checklist.

### Step 9.5 — Generic / Claude vision fallback

Screenshot + simplified DOM → Claude action plan → execute with verification screenshot.

**Edge cases**

- **Unsafe actions:** whitelist allowed action types; no arbitrary JS execution.
- **Infinite loops:** max steps per session.

### Step 9.6 — CAPTCHA + 2Captcha

Integrate per technical PRD §4.4.

**Edge cases**

- **Timeout / insufficient balance:** surface actionable error; status `manual_needed`.
- **CAPTCHA types:** unknown type → do not spin forever.

### Step 9.7 — Screenshots

Pre-fill, post-fill, post-submit to GCS paths per PRD.

**Edge cases**

- **Huge PNGs:** compress or resize for storage cost.

### Step 9.8 — Anti-bot measures (best effort)

Stealth plugin, delays, user-agent rotation—coordinate with global rate limits (PRD §4.2 backend + technical §5.5).

**Edge cases**

- **Legal/ToS:** document that automation targets user-consented flows; respect `robots.txt` where applicable and product policy.

---

## Phase 10 — Apply from link / pasted URL (newest product feature)

This implements **General PRD §5.6**, **Technical PRD workflow `apply_from_pasted_url`**, and README “Apply from a link.” Backend must treat it as **equal** to other application entry points regarding artifacts, tracker rows, feed events, and failure semantics.

### Step 10.1 — API design (add to backend; PRD lists routes conceptually)

Recommended REST shape (adapt names to your router style):

```
POST /api/jobs/from-url
```

- **Auth:** required (Firebase or demo token—same as rest of API).
- **Body (JSON):**
  - `url` (string, required unless `job_description_text` alone is allowed): user-submitted job posting or application URL.
  - `job_description_text` (string, optional): fallback when fetch/extract fails or is low-confidence.
  - `force_manual_submit` (boolean, optional): skip Playwright submit attempt (user knows portal is auth-walled).

**Response (202 Accepted):** asynchronous processing is recommended:

```json
{
  "application_id": "string",
  "status": "queued",
  "listing_id": "string",
  "message": "Processing started"
}
```

Also expose:

```
GET /api/jobs/from-url/:application_id/status
```

for polling when WebSocket is disconnected—or reuse `GET /api/applications/:id`.

**Edge cases**

- **Invalid URL:** reject with 400 (`INVALID_URL`) for malformed strings; do not pass to fetch.
- **Non-http(s):** reject `javascript:`, `file:`, etc.
- **SSRF / internal network:** **block** private IP ranges, link-local, metadata IPs (169.254.169.254), and localhost; allow-list redirects; cap redirect count (e.g. max 5).
- **DNS rebinding:** use resolved address check before connecting; prefer a hardened HTTP client policy.
- **Huge pages:** cap downloaded bytes (e.g. 5MB) and HTML parse time.
- **Binary responses:** detect content-type; reject non-text/HTML.

### Step 10.2 — Fetch layer (`fetch_url`)

Choose implementation per technical PRD:

- **Plain HTTP fetch** for simple public pages **after SSRF controls**.
- **Playwright fetch** when you need a real browser (heavy JS, anti-bot).

**Edge cases**

- **403/401/407:** classify as `login_wall` → response to client should include `next_step: "paste_jd"` (no endless retries).
- **429:** backoff; if still blocked, same as above.
- **Infinite meta refresh / redirect loops:** capped already.
- **Geo blocking:** surface `blocked_region` if detectable.
- **TLS errors:** do not disable cert verification in prod.

### Step 10.3 — Extract listing (`extract_listing`)

Pipeline:

1. Parse JSON-LD `JobPosting` if present.
2. Read Open Graph `title`, `description`, `site_name`.
3. Strip boilerplate (readability / cheerio)—keep main text for Claude.
4. Claude returns normalized listing: `title`, `company`, `location`, `description`, `application_url`, `inferred_custom_questions`, `requires_cover_letter` guess, `confidence` 0–1.

**Edge cases**

- **Multiple JSON-LD blocks:** pick best scoring JobPosting.
- **Company name unknown:** allow `company: null` but require user confirmation in UI; block auto-submit if business rules require company for outreach.
- **Application URL vs listing URL:** store both—submission uses application URL when different.

### Step 10.4 — JD fallback (`job_description_text`)

If fetch fails OR `confidence < threshold` OR extraction empty:

- Persist a **draft listing** with `source: "manual_paste"` and `needs_jd: true` until text provided (if you split steps).
- When text arrives, re-run extraction **without** fetch.

**Edge cases**

- User pastes **only** salary/legal boilerplate → Claude returns low confidence; ask for more content.
- Extremely long paste → truncate with summarization pass.

### Step 10.5 — Persist listing + application

- Create `listings/{id}` with `source: "user_url"` or `manual_paste` and link to original URL.
- Create `users/{uid}/applications/{id}` with `status: queued` → pipeline states mirror normal apply.

**Edge cases**

- **Duplicate URL** for same user: offer idempotent return of existing in-flight application (query by normalized URL + uid).

### Step 10.6 — Continue as `apply_to_job`

From `analyze_job` onward, **reuse the exact same services** as Phase 8–9. No forked logic beyond listing construction.

**Edge cases**

- **Different ATS URL than JD page:** use user-provided `url` for Playwright if it is the apply URL; if user pasted job board link only, attempt to discover apply link from extracted HTML; if not found, `manual_needed` with checklist item “Open apply URL”.

### Step 10.7 — WebSocket feed events

Emit the same event types as queued applications (`generating_resume`, `compiling_pdf`, `ats_scoring`, …, `manual_needed`, `submitted`).

**Edge cases**

- **Long fetch:** emit `fetching_job_page` / `extracting_listing` events so UI is not silent.

### Step 10.8 — Product-aligned failure messaging

Return structured errors to the client for UI:

- `FETCH_BLOCKED`, `LOW_CONFIDENCE_EXTRACTION`, `SSRF_BLOCKED`, `TIMEOUT`, `UNSUPPORTED_SCHEME`.

---

## Phase 11 — Applications HTTP API

Implement routes from `docs/03_BACKEND_PRD.md` §3.4.

### Step 11.1 — List + detail

- Filters: `status`, `method`, pagination.
- Detail includes scores, artifact paths, notes.

**Edge cases**

- Authorization: never return another user’s application ID.

### Step 11.2 — Signed URLs for artifacts

`GET .../resume`, `cover-letter`, `screenshot` can either redirect to signed URL or return JSON `{ url, expires_at }`.

**Edge cases**

- **Expired links:** regenerate on demand.
- **Missing artifact:** 404 with code `ARTIFACT_NOT_READY`.

### Step 11.3 — `POST .../retry`

Re-enqueue apply job from last safe step; dedupe retries.

**Edge cases**

- Retry storm → rate limit per application.

### Step 11.4 — `POST .../manual-done`

User confirms manual completion; update status and timestamps.

**Edge cases**

- Invalid state transition → 409.

### Step 11.5 — `PUT .../notes`

Persist user notes; optional length limit.

---

## Phase 12 — Interview loop APIs

Routes from backend PRD §3.5.

**Edge cases**

- **Calendar not connected:** `confirm-interview` should still send mail but return `calendar_event_created: false`.
- **Ambiguous time zones:** require ISO with offset from client.
- **Email send failure:** rollback or compensate with `interview_scheduled` only after successful send—define idempotency.

---

## Phase 13 — Live feed: REST + WebSocket

### Step 13.1 — `GET /api/feed`

Paged history for clients without WS.

**Edge cases**

- Large histories: cap page size; index by `uid` + `timestamp`.

### Step 13.2 — `WS /ws/feed?token=...`

Verify Firebase token on connect; associate socket with `uid`.

**Edge cases**

- **Token expires during long session:** client must reconnect with fresh token—document protocol.
- **Multiple tabs:** fan-out same events to all connections for `uid`.
- **Backpressure:** drop or coalesce events if client slow (optional).

### Step 13.3 — Event schema

Use PRD payload shape (`type`, `data` with `action` enum).

**Edge cases**

- **PII in `detail`:** avoid raw emails/phone in feed text where not needed.

---

## Phase 14 — AgentMail outbound + inbound webhook

### Step 14.1 — Outbound send helper

Attach resume PDFs as base64 per PRD example.

**Edge cases**

- **Attachment size limits** on AgentMail API.
- **Retry with idempotency key** per message.

### Step 14.2 — `POST /api/webhooks/agentmail`

Verify `AGENTMAIL_WEBHOOK_SECRET` (HMAC or shared secret per AgentMail docs).

**Edge cases**

- **Replay attacks:** timestamp tolerance.
- **Unknown `to` address:** 404 vs 200—prefer 200 to avoid webhook retry storms while logging.
- **Duplicate deliveries:** idempotent processing via message ID store.

### Step 14.3 — `classify` queue

Run `process_response` workflow: classify → update application → optional Sheets + WS.

**Edge cases**

- **Thread matching ambiguity:** if multiple applications match sender domain, use heuristics (subject keywords, most recent, user disambiguation flag).

---

## Phase 15 — Google Sheets sync

OAuth + tokens encrypted at rest (PRD §8–9).

**Edge cases**

- **Token refresh failure:** disable sync with user-visible error; pause periodic job.
- **Sheet manually deleted:** detect API errors; mark integration disabled.
- **Bidirectional sync conflicts:** last-writer-wins vs timestamp column—define policy; PRD suggests periodic compare.

---

## Phase 16 — Rate limiting, quotas, and abuse controls

Implement PRD limits:

- Per-user daily application cap.
- Per-ATS-domain hourly cap.
- Global Playwright concurrency cap.

**Edge cases**

- **Distributed workers:** use Redis counters / tokens, not in-memory only.
- **Demo mode:** separate lower limits.

---

## Phase 17 — Observability, health, and operations

- `/healthz` liveness; `/readyz` checks Firestore + Redis.
- Metrics: queue depth, job durations, Claude token usage estimates, Playwright success rate.

**Edge cases**

- **PII in traces:** scrub CV and JD from APM.

---

## Phase 18 — Testing strategy (minimum bar)

- **Unit tests:** URL normalize, SSRF guard, LaTeX sanitizer, Firestore serializers.
- **Integration tests:** Firebase emulator + supertest for auth middleware.
- **E2E (optional):** Playwright against a static HTML form fixture in CI.

**Edge cases**

- Flaky network tests: record fixtures; do not hit real ATS in CI by default.

---

## Phase 19 — Docker and deployment

- Dockerfile: Node 20 + texlive + Playwright Chromium deps (PRD patterns).
- `docker-compose`: `api`, `worker`, `redis` (PRD §10.1).

**Edge cases**

- **Playwright in slim images:** install full dependency list per Playwright docs.
- **Separate worker scaling:** workers do not open HTTP port; only API does.

---

## Phase 20 — Final integration: frontend + backend as one product

This phase turns the Vite/React frontend (`frontend/`) and the new backend into a **single coherent app** for local dev and production.

### Step 20.1 — Define the API contract document

- Export an **OpenAPI spec** or typed `shared/` contract (e.g. Zod schemas) covering:
  - Auth headers (`Authorization: Bearer`)
  - All REST routes above, including **`POST /api/jobs/from-url`**
  - Error JSON shape: `{ error: string, code?: string, details?: unknown }`
  - WebSocket event types

**Edge cases**

- Version the API (`/api/v1`) if you expect breaking changes during demo iterations.

### Step 20.2 — CORS and cookies

- If all same-origin in prod (recommended), **avoid CORS** by serving the SPA and API behind one host (reverse proxy).
- If cross-origin (Vercel + Railway): configure CORS allowlist to `FRONTEND_URL` only; do not use `*`.

**Edge cases**

- WebSocket origins must be allowed in WS server config.

### Step 20.3 — Vite dev proxy

In `vite.config.ts`, proxy `/api` and `/ws` to the backend (e.g. `localhost:3000`) so the browser sees same origin and no CORS pain during development.

**Edge cases**

- WebSocket proxy path (`/ws`) must use `ws: true` (or equivalent) in Vite server proxy settings.

### Step 20.4 — Environment variables (frontend)

- Firebase **client** config (`VITE_` or `NEXT_PUBLIC_` style prefixes depending on bundler).
- `VITE_API_URL` empty in dev if using proxy; set to public API URL in prod **only if** not same-origin.

**Edge cases**

- Never embed Admin SDK keys or `AGENTMAIL_API_KEY` in frontend env.

### Step 20.5 — Replace demo data paths with API calls

Systematically migrate screens:

- **Login / Register:** real Firebase client auth; on success call `POST /api/auth/register` once.
- **Skip demo:** call `POST /api/auth/skip` only in demo builds or behind a flag; store returned token and send as Bearer for demo APIs.
- **Onboarding:** wire CV upload + profile saves to profile routes.
- **Live Feed:** WebSocket connect with refreshed ID token; fallback poll `GET /api/feed`.
- **Jobs board / applications / resume vault / settings:** map to jobs, applications, sheets routes.

**Edge cases**

- **Loading and error states:** every call needs skeleton, toast, and retry for transient 5xx.
- **Token refresh:** on 401, refresh Firebase token once and retry; if still 401, sign out.

### Step 20.6 — Implement “Apply from link” UI (frontend)

Per README and general PRD:

- Input: URL field + optional “Paste job description” textarea (collapsed until needed).
- Submit → `POST /api/jobs/from-url`.
- Show progress via feed events; on `LOW_CONFIDENCE_EXTRACTION` or `FETCH_BLOCKED`, prompt for JD paste and call endpoint again with `job_description_text` (same `application_id` if you support resume, or create new—define one idempotent strategy).

**Edge cases**

- **Double submit:** disable button while `202` in flight.
- **Copy-paste of mobile URLs:** normalize before send.

### Step 20.7 — Production hosting patterns (choose one)

**Option A — Same domain (recommended)**

- Reverse proxy (nginx, Caddy, or platform ingress): `/` → static SPA, `/api` → Node API, `/ws` → WS upgrade.
- One TLS cert; simplest cookies/CORS story.

**Option B — Split domains**

- SPA on `app.example.com`, API on `api.example.com` with strict CORS + correct `API_BASE_URL` for webhooks and OAuth redirects.

**Edge cases**

- **Webhook URLs** (`AgentMail`) must point to **public** API, not internal cluster DNS.

### Step 20.8 — Build and deploy scripts

- Root `package.json` scripts: `dev` runs API + worker + Vite concurrently (e.g. `concurrently`).
- CI: lint, test, build backend `dist`, build frontend `dist`, Docker image publish.

**Edge cases**

- Do not run worker inside API process in production (scaling and CPU isolation).

### Step 20.9 — End-to-end smoke checklist (must pass before “done”)

1. Register → upload CV → complete profile → listing appears from scraper or manual seed.
2. Approve job → full apply pipeline → application row updates → feed events received.
3. Paste **apply-from-link** URL → extraction succeeds → artifacts generated → tracker row matches normal apply.
4. Blocked URL path → user pastes JD → pipeline completes.
5. AgentMail webhook test payload updates application state.
6. Sheets row append on apply (if enabled).
7. Signed URL opens resume PDF in browser.
8. WebSocket reconnect after token refresh works.

---

## Appendix A — Mapping PRD workflows to implementation

| Workflow (Technical PRD) | Primary implementation |
|--------------------------|-------------------------|
| `onboard_user` | Profile routes + optional AgentMail setup |
| `scrape_jobs` | `scrape` queue + GitHub + Claude |
| `match_and_queue` | `match` queue + Firestore writes |
| `apply_to_job` | `apply` queue + resume + Playwright + email |
| `apply_from_pasted_url` | `POST /api/jobs/from-url` + fetch/extract + reuse `apply_to_job` |
| `process_response` | AgentMail webhook + `classify` queue |
| `interview_loop` | Interview routes + scheduler job + AgentMail |

---

## Appendix B — Error code catalog (suggested)

Consistent `code` fields speed frontend handling:

- `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`
- `CV_PARSE_FAILED`, `ARTIFACT_NOT_READY`, `MANUAL_COMPLETION_REQUIRED`
- `FETCH_BLOCKED`, `SSRF_BLOCKED`, `INVALID_URL`, `EXTRACTION_LOW_CONFIDENCE`

---

## Appendix C — Out-of-scope reminders (from general PRD)

- Full Workday automation (expect `manual_needed`).
- Email deliverability hardening beyond basic send.
- Mobile app, payments, full LinkedIn API (CSV only).

---

*End of implementation steps document.*
