# AutoApply - Technical Product Requirements Document

**Project:** OpenClaw Demo - Automated College Internship & Job Application Platform
**Version:** 1.0
**Date:** April 2026

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        WEB CLIENT                           │
│  React + Tailwind (Vercel)                                  │
│  - Live Feed, Jobs Board, Tracker, Resume Vault, Settings   │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                     API SERVER                               │
│  Node.js + Express (Railway / Render)                        │
│  - Firebase Auth middleware                                  │
│  - WebSocket server (live feed)                              │
│  - REST endpoints for all CRUD                               │
│  - Webhook receiver (AgentMail inbound)                      │
└──────┬──────────┬──────────┬──────────┬─────────────────────┘
       │          │          │          │
┌──────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────────────┐
│ Firestore│ │Firebase│ │  GCS   │ │  OpenClaw Engine     │
│ Database │ │  Auth  │ │Storage │ │  (Workflow Orchestr.) │
└──────────┘ └────────┘ └────────┘ └───┬──────────────────┘
                                       │
                    ┌──────────────────┬┴──────────────┬──────────────┐
                    │                  │               │              │
              ┌─────▼─────┐    ┌──────▼──────┐ ┌──────▼─────┐ ┌─────▼──────┐
              │  Claude    │    │  Playwright  │ │ AgentMail  │ │ External   │
              │  API       │    │  Browser     │ │ Email      │ │ APIs       │
              │  (Sonnet)  │    │  Automation  │ │ Service    │ │            │
              └────────────┘    └─────────────┘ └────────────┘ └────────────┘
                                                                 │
                                                    ┌────────────┼────────────┐
                                                    │            │            │
                                              ┌─────▼──┐  ┌─────▼──┐  ┌─────▼──────┐
                                              │Apollo  │  │GitHub  │  │Google      │
                                              │.io API │  │API     │  │Sheets/Cal  │
                                              └────────┘  └────────┘  └────────────┘
```

---

## 2. OpenClaw Workflows

OpenClaw is the orchestration layer. All multi-step agent processes are defined as OpenClaw workflows. Each step is an agent action that can call tools and pass output to subsequent steps.

### 2.1 Workflow Definitions

**workflow: onboard_user**
```
trigger: manual (user completes onboarding form)
steps:
  1. parse_cv
     tool: claude_api
     input: raw CV text/PDF
     output: structured CV JSON
  2. validate_profile
     tool: none (user interaction, handled by frontend)
     input: parsed CV JSON
     output: corrected CV JSON
  3. build_profile
     tool: internal
     input: corrected CV JSON + questionnaire responses
     output: complete profile JSON stored in Firestore
  4. parse_linkedin_connections
     tool: claude_api (conditional, if CSV uploaded)
     input: LinkedIn connections CSV
     output: structured connections array stored in Firestore
```

**workflow: scrape_jobs**
```
trigger: cron (every 2 hours)
steps:
  1. fetch_github_repos
     tool: github_api
     input: list of repo URLs
     output: raw markdown content per repo
  2. parse_listings
     tool: claude_api
     input: raw markdown + previous parse hash
     output: array of structured job listing objects
  3. diff_and_store
     tool: firestore
     input: new listings array
     output: net-new listings flagged
  4. ghost_detection
     tool: claude_api + playwright (link health check)
     input: each new listing
     output: ghost probability score per listing
  5. timing_analysis
     tool: internal (historical data query)
     input: company + role type
     output: estimated urgency score
  6. fetch_apollo_contacts
     tool: apollo_api
     input: company names from new listings
     output: recruiter email contacts stored
```

**workflow: match_and_queue**
```
trigger: on_complete(scrape_jobs)
steps:
  1. score_listings
     tool: claude_api
     input: each new listing + user profile JSON
     output: fit score (0-100) + reasoning
  2. check_referrals
     tool: internal (LinkedIn connections lookup)
     input: company names
     output: referral paths flagged
  3. queue_applications
     tool: firestore
     input: listings above threshold
     output: application queue updated
  4. notify_user
     tool: websocket
     input: new matched jobs
     output: live feed + jobs board updated
```

**workflow: apply_to_job**
```
trigger: job enters application queue (auto or manual approval)
steps:
  1. analyze_job
     tool: claude_api
     input: job description text
     output: required_skills, preferred_skills, company_context, custom_questions
  2. generate_resume
     tool: claude_api
     input: CV JSON + step 1 output
     output: LaTeX resume content
  3. compile_resume
     tool: bash (pdflatex)
     input: LaTeX content + template
     output: PDF file path
     on_failure: flag for manual, stop
  4. ats_score
     tool: claude_api + pdftotext
     input: PDF text + job description keywords
     output: score (0-100) + matched/missing keywords
     on_low_score (<70): retry step 2 with feedback, max 2 retries
  5. generate_cover_letter
     tool: claude_api
     conditional: only if listing requires cover letter
     input: job description + CV JSON + resume content
     output: cover letter text (PDF compiled)
  6. generate_custom_answers
     tool: claude_api
     input: custom questions from step 1 + profile JSON + essay bank
     output: answer map {question: answer}
  7. detect_ats
     tool: internal (URL pattern matching)
     input: application URL
     output: ats_type (greenhouse|lever|icims|smartrecruiters|workday|unknown)
  8. solve_captcha
     tool: 2captcha_api
     conditional: only if CAPTCHA detected during form fill
     input: sitekey + page URL + captcha type
     output: solution token
     on_failure: flag for manual
  9. submit_application
     tool: playwright
     input: application URL + PDF + cover letter + profile JSON + answer map + captcha token
     output: success/failure + screenshot
     on_failure: flag for manual, save screenshot
  10. send_outreach
      tool: agentmail_api
      conditional: only if recruiter contact exists
      input: recruiter email + personalized message + resume PDF
      output: sent confirmation
  11. update_tracking
      tool: firestore + google_sheets_api (conditional)
      input: application result
      output: DB row created, sheet row appended, live feed event emitted
```

**workflow: process_response**
```
trigger: agentmail_webhook (inbound email received)
steps:
  1. classify_response
     tool: claude_api
     input: email subject + body text
     output: category (rejection|interview|info_request|auto_reply)
  2. handle_rejection
     conditional: category == rejection
     tool: claude_api
     input: rejection timing + original application data
     output: rejection type (auto_screen|post_review), ATS keyword gap analysis
  3. handle_interview
     conditional: category == interview
     tool: claude_api
     input: email body
     output: proposed times, interviewer names, format (phone/video/onsite)
  4. check_calendar
     conditional: category == interview AND google calendar connected
     tool: google_calendar_api
     input: proposed times
     output: available slots
  5. draft_confirmation
     conditional: category == interview
     tool: claude_api
     input: available slots + interview details
     output: confirmation email draft
  6. update_tracking
     tool: firestore + google_sheets_api + websocket
     input: classification result
     output: DB updated, sheet updated, feed event emitted
```

**workflow: interview_loop**
```
trigger: interview confirmed
steps:
  1. generate_prep
     tool: claude_api + web_search
     input: company name + role + resume used
     output: prep document (company info, likely questions, talking points)
  2. await_interview_notes
     trigger: user submits post-interview notes
     input: interviewer names, topics discussed, user impressions
  3. draft_thank_you
     tool: claude_api
     input: interview notes + company context
     output: personalized thank-you email
  4. send_thank_you
     tool: agentmail_api
     input: approved thank-you email
     output: sent confirmation
  5. set_followup_timer
     tool: internal (scheduler)
     input: 5 business days from interview date
  6. draft_followup
     trigger: timer fires AND no response received
     tool: claude_api
     input: original application context
     output: follow-up email draft
  7. send_followup
     tool: agentmail_api
     input: approved follow-up email
     output: sent confirmation
```

---

## 3. MCP Servers (Model Context Protocol)

MCPs allow Claude to interact with external services directly within workflow steps. The following MCPs are used:

### 3.1 Required MCPs

| MCP | Purpose | URL / Integration |
|-----|---------|-------------------|
| **Google Calendar MCP** | Check availability, create interview events | `https://gcal.mcp.claude.com/mcp` |
| **Gmail MCP** | Backup email channel, notification delivery | `https://gmail.mcp.claude.com/mcp` |

### 3.2 Custom Tool Integrations (Not MCP, Direct API)

These are called as tools within OpenClaw steps, not through MCP protocol:

| Integration | Purpose | API |
|-------------|---------|-----|
| **Claude API** | Resume generation, CV parsing, classification, scoring, cover letters, custom answers | Anthropic Messages API (`claude-sonnet-4-20250514`) |
| **AgentMail** | Outbound email, inbound webhook, per-user agent email addresses | AgentMail REST API |
| **Apollo.io** | Recruiter contact enrichment, company data | Apollo REST API |
| **GitHub API** | Fetch raw markdown from job listing repos | GitHub REST API (raw content endpoint) |
| **Google Sheets API** | Create/read/update spreadsheets for application tracking | Google Sheets API v4 |
| **Google Calendar API** | Read/write calendar events for interview scheduling | Google Calendar API v3 |
| **2Captcha** | Solve reCAPTCHA v2/v3, hCaptcha during ATS form fill | 2Captcha REST API |
| **Playwright** | Browser automation for ATS form submission | Local Playwright instance (headless Chromium) |

### 3.3 MCP Usage in Anthropic API Calls

When Claude needs to interact with Google Calendar or Gmail within a workflow step, the API call includes the MCP server:

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: "Check calendar availability for Thursday 2-4pm" }],
    mcp_servers: [
      { type: "url", url: "https://gcal.mcp.claude.com/mcp", name: "google-calendar" }
    ]
  })
});
```

---

## 4. External APIs - Detailed Integration Specs

### 4.1 GitHub API (Job Scraping)

**Endpoint:** `https://api.github.com/repos/{owner}/{repo}/contents/README.md`
**Alternative (raw):** `https://raw.githubusercontent.com/{owner}/{repo}/main/README.md`
**Auth:** Personal access token (5000 req/hr) or unauthenticated (60 req/hr)
**Rate limit strategy:** Use token. Cache responses. Only re-fetch if SHA has changed.

**Repos to scrape:**
- `SimplifyJobs/Summer2025-Internships` (update repo name for current cycle)
- `SimplifyJobs/New-Grad-Positions`
- `pittcsc/Summer2025-Internships`
- `ReaVNaiL/New-Grad-2025`

**Parsing approach:** Send raw markdown to Claude, not regex. Claude extracts structured JSON array of listings. Handles format variations, missing columns, footnotes, embedded links.

**Change detection:** Store last known commit SHA per repo. Use GitHub API to check current SHA before fetching. If unchanged, skip. If changed, use diff API for incremental parsing to reduce token usage.

### 4.2 Apollo.io API

**Endpoint:** `https://api.apollo.io/v1/mixed_people/search`
**Auth:** API key
**Purpose:** Find recruiter/hiring manager contacts at target companies.
**Rate limits:** Depends on plan tier. Free tier is limited.
**Fields needed:** name, email, title, company, LinkedIn URL.
**Query strategy:** Search by company name + title filters ("recruiter", "hiring manager", "talent acquisition", "university recruiting").

### 4.3 AgentMail

**Outbound:** REST API to send emails from per-user agent addresses.
**Inbound:** Webhook endpoint on API server receives POST with email data (sender, subject, body, attachments).
**Per-user setup:** During onboarding, create an agent email address for each user. All outbound goes from this address. Inbound to this address triggers the process_response workflow.

### 4.4 2Captcha

**Endpoint:** `https://2captcha.com/in.php` (submit) and `https://2captcha.com/res.php` (poll result)
**Flow:**
1. POST to `/in.php` with `method=userrecaptcha`, `googlekey={sitekey}`, `pageurl={url}`
2. Receive task ID
3. Poll `/res.php` with task ID every 5 seconds
4. Receive token on success
5. Inject token into `g-recaptcha-response` textarea via Playwright

**Cost:** ~$3 per 1000 solves. Budget $10/month for demo usage.

### 4.5 Google Sheets API v4

**Auth:** OAuth 2.0 (user grants access during onboarding) or service account with sheet sharing.
**Operations used:**
- `spreadsheets.create` - create tracking sheet
- `spreadsheets.values.append` - add new application row
- `spreadsheets.values.update` - update status on existing row
- `spreadsheets.values.get` - read sheet (for bidirectional sync, detect manual additions)

**Sheet schema:**
| Column | Field |
|--------|-------|
| A | Company |
| B | Role |
| C | Location |
| D | Source |
| E | Fit Score |
| F | ATS Score |
| G | Status |
| H | Method |
| I | Resume Link |
| J | Cover Letter Link |
| K | Applied Date |
| L | Response |
| M | Response Date |
| N | Next Action |
| O | Notes |

### 4.6 Google Calendar API v3

**Auth:** OAuth 2.0 (user grants access during onboarding)
**Operations used:**
- `events.list` - check availability for proposed interview times
- `events.insert` - create interview event with details

---

## 5. Browser Automation (Playwright)

### 5.1 Architecture

Playwright runs headless Chromium in the backend. One browser context per application submission. Each context gets a fresh session to avoid cross-contamination.

### 5.2 ATS Adapter Pattern

```
adapters/
  greenhouse.ts    -- boards.greenhouse.io, job-boards.greenhouse.io
  lever.ts         -- jobs.lever.co
  smartrecruiters.ts -- jobs.smartrecruiters.com
  icims.ts         -- *.icims.com
  workday.ts       -- *.myworkdayjobs.com (partial, flags complex flows)
  generic.ts       -- Claude vision fallback
  detector.ts      -- URL pattern matching to select adapter
```

### 5.3 Adapter Interface

Every adapter implements:

```typescript
interface ATSAdapter {
  detect(url: string): boolean;
  fill(page: Page, data: ApplicationData): Promise<FillResult>;
  submit(page: Page): Promise<SubmitResult>;
  handleCaptcha(page: Page, solver: CaptchaSolver): Promise<boolean>;
}

interface ApplicationData {
  profile: ProfileJSON;
  resumePath: string;
  coverLetterPath?: string;
  customAnswers: Record<string, string>;
}

interface FillResult {
  success: boolean;
  screenshot: string; // base64
  unfilledFields: string[];
}
```

### 5.4 Generic Fallback (Claude Vision)

When no adapter matches:
1. Navigate to URL, wait for load.
2. Take full-page screenshot.
3. Extract simplified DOM (strip scripts/styles, keep form elements with selectors).
4. Send screenshot + DOM + application data to Claude.
5. Claude returns JSON: `[{selector: "...", action: "fill|click|select|upload", value: "..."}]`
6. Playwright executes each action.
7. Take verification screenshot.
8. If form looks complete, submit. Otherwise flag for manual.

### 5.5 Anti-Bot Measures

- Use `playwright-extra` with `stealth` plugin.
- Randomize timing between actions (200-800ms per field).
- Randomize mouse movement paths.
- Use residential proxy rotation (provider TBD, BrightData or similar).
- Limit to 5-10 applications per hour per IP.
- Rotate user agents.

---

## 6. Claude API Usage

### 6.1 Model Selection

All Claude calls use `claude-sonnet-4-20250514`. Fast enough for real-time pipeline execution, smart enough for resume generation and classification.

### 6.2 Prompt Inventory

| Prompt | Purpose | Estimated Tokens (in/out) |
|--------|---------|--------------------------|
| cv_parse | Parse uploaded CV into structured JSON | 5000 / 3000 |
| job_extract | Extract listings from GitHub markdown | 10000 / 5000 |
| fit_score | Score listing against profile | 2000 / 500 |
| resume_generate | Generate tailored LaTeX resume | 4000 / 2000 |
| resume_validate | Check resume against CV for accuracy | 3000 / 500 |
| ats_keywords | Extract keywords from job description | 1000 / 300 |
| cover_letter | Generate cover letter | 3000 / 1000 |
| custom_answers | Answer application custom questions | 2000 / 800 |
| response_classify | Classify inbound email | 500 / 100 |
| ghost_detect | Assess ghost job probability | 1000 / 200 |
| thank_you_email | Draft post-interview thank you | 1000 / 500 |
| generic_form_fill | Vision-based form field mapping | 5000 / 1000 |

### 6.3 Estimated Cost Per Application

Roughly 20,000-25,000 input tokens and 8,000-10,000 output tokens per full application cycle (resume + cover letter + custom answers + ATS score). At Sonnet pricing, approximately $0.05-0.10 per application.

---

## 7. Data Models

### 7.1 Profile JSON (Firestore: `users/{uid}/profile`)

```json
{
  "uid": "string",
  "email": "string",
  "cv": {
    "education": [{ "school": "", "degree": "", "major": "", "gpa": "", "graduation": "", "coursework": [], "honors": [] }],
    "experience": [{ "company": "", "role": "", "dates": "", "bullets": [], "skills_used": [] }],
    "projects": [{ "name": "", "description": "", "tech_stack": [], "bullets": [] }],
    "skills": { "languages": [], "frameworks": [], "tools": [], "other": [] },
    "extracurriculars": [],
    "awards": [],
    "publications": [],
    "certifications": []
  },
  "questionnaire": {
    "work_auth": { "authorized": true, "sponsorship_needed": false, "citizenship": "", "visa_type": "" },
    "demographics": { "gender": "", "ethnicity": "", "veteran": "", "disability": "" },
    "education_meta": { "graduation_date": "", "student_status": true },
    "availability": { "start_date": "", "terms": [], "locations": [], "relocate": true, "remote_ok": true },
    "defaults": { "hear_about": "", "salary": "" },
    "essays": { "technical_project": "", "teamwork": "", "challenge": "", "motivation": "" }
  },
  "preferences": {
    "resume_template": "jakes|sidebar|minimal",
    "auto_apply_threshold": 75,
    "daily_limit": 20,
    "sheets_enabled": false,
    "sheets_id": "",
    "calendar_connected": false,
    "linkedin_connections": []
  },
  "agentmail_address": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### 7.2 Job Listing (Firestore: `listings/{id}`)

```json
{
  "id": "string",
  "company": "string",
  "role": "string",
  "location": "string",
  "url": "string",
  "source": "simplify|pittcsc|reavnail|apollo|manual",
  "description": "string",
  "posted_date": "timestamp",
  "first_seen": "timestamp",
  "last_seen": "timestamp",
  "ghost_score": 0,
  "ghost_reasons": [],
  "urgency_score": 0,
  "urgency_label": "string",
  "ats_type": "greenhouse|lever|workday|icims|smartrecruiters|unknown",
  "requires_cover_letter": false,
  "custom_questions": [],
  "active": true
}
```

### 7.3 Application (Firestore: `users/{uid}/applications/{id}`)

```json
{
  "id": "string",
  "listing_id": "string",
  "user_id": "string",
  "status": "queued|applying|applied|emailed|waiting|rejected_auto|rejected_review|interview_scheduled|thank_you_sent|followup_sent|offer|accepted|declined|manual_needed",
  "method": "ats|email|both",
  "fit_score": 0,
  "ats_score": 0,
  "ats_keywords_matched": [],
  "ats_keywords_missing": [],
  "resume_url": "string (GCS path)",
  "cover_letter_url": "string (GCS path)",
  "custom_answers": {},
  "submission_screenshot": "string (GCS path)",
  "applied_date": "timestamp",
  "response_date": "timestamp",
  "response_type": "string",
  "response_raw": "string",
  "interview_date": "timestamp",
  "interviewer_names": [],
  "interview_format": "string",
  "interview_notes": "string",
  "thank_you_sent": "timestamp",
  "followup_sent": "timestamp",
  "referral_available": false,
  "referral_contact": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## 8. Infrastructure

| Component | Service | Justification |
|-----------|---------|---------------|
| Frontend | Vercel | Free tier, fast deploys, good for React |
| API Server | Railway or Render | Node.js hosting, WebSocket support, auto-deploy |
| Database | Firebase Firestore | Real-time sync, good free tier, easy auth integration |
| Auth | Firebase Auth | Email/password + Google OAuth, free tier sufficient |
| File Storage | Google Cloud Storage | Resume PDFs, screenshots, cover letters |
| Browser Automation | Self-hosted Docker container or Browserless.io | Playwright needs a browser runtime |
| LaTeX Compilation | Same Docker container (texlive installed) | Compiles resume PDFs |
| Cron Jobs | Railway cron or Cloud Scheduler | Triggers scrape_jobs workflow |
| OpenClaw Engine | Self-hosted alongside API server | Workflow orchestration |

---

## 9. Security Considerations

- All API keys stored in environment variables, never in client code.
- Firebase Auth tokens validated on every API request.
- User CV data encrypted at rest in Firestore.
- AgentMail webhook endpoint validates request signatures.
- Playwright browser contexts are isolated and destroyed after each submission.
- 2Captcha API key rotated monthly.
- Google OAuth tokens stored encrypted, refreshed automatically.
- Rate limiting on API endpoints to prevent abuse.
