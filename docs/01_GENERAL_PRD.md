# AutoApply - General Product Requirements Document

**Project:** OpenClaw Demo - Automated College Internship & Job Application Platform
**Version:** 1.0
**Date:** April 2026

---

## 1. Product Overview

AutoApply is an end-to-end job application automation system built on OpenClaw. A user uploads their CV once, answers a one-time questionnaire, and the system handles everything else: scraping job listings, generating tailored resumes and cover letters, filling ATS forms via browser automation, sending recruiter outreach emails, tracking responses, and managing the interview lifecycle.

The product is a demo of OpenClaw's agent orchestration capabilities. The use case is college internships and new grad positions.

---

## 2. Problem Statement

Applying to internships and entry-level jobs is a high-volume, repetitive process. A typical CS student applies to 50-200+ positions per cycle. Each application requires: finding the listing, tailoring a resume, writing a cover letter (sometimes), navigating an ATS form, uploading documents, answering custom questions, and tracking the result. This takes hundreds of hours per cycle.

Existing tools solve fragments of this problem. Simplify auto-fills forms but uses the same resume every time. Teal helps with resume tailoring but does not submit. Huntr tracks applications but does not apply. Nobody closes the full loop from discovery to interview scheduling.

---

## 3. Target User

College students (primarily CS/engineering) applying to summer internships and new grad roles in tech. They have:

- A CV or long-form resume with all their experience
- Limited time (full course load)
- Willingness to let automation handle the grunt work
- Need for visibility into what is being sent on their behalf

---

## 4. Core Value Proposition

Upload your CV. Get interviews. Everything in between is automated.

---

## 5. User Flows

### 5.1 Onboarding (One-Time)

1. User creates account (Firebase auth, email/password or Google OAuth).
2. User uploads CV (PDF or DOCX). System parses it into structured JSON using Claude.
3. User reviews and corrects parsed CV data in the web UI.
4. User completes questionnaire:
   - Work authorization status
   - Demographic info (optional, for EEO fields)
   - Education details (school, degree, major, GPA, graduation date)
   - Availability and location preferences
   - Default answers for common questions ("How did you hear about us?", salary expectations, etc.)
   - 3-4 essay paragraphs (a technical project, a teamwork experience, a challenge, motivation for target field) used as raw material for custom questions.
5. User selects resume template (2-3 LaTeX templates).
6. User optionally uploads LinkedIn connections CSV (for referral mining).
7. User optionally connects Google Calendar (for interview scheduling).
8. User optionally enables Google Sheets sync.
9. Profile JSON is created and stored.

### 5.2 Job Discovery (Continuous, Automated)

1. Scraper runs every 2-4 hours.
2. Sources: GitHub repos (SimplifyJobs, PittCSC, ReaVNaiL, etc.), Apollo.io for recruiter contacts.
3. New listings are parsed by Claude (format-resilient, handles markdown table changes).
4. Listings are diffed against database. New ones are stored.
5. Ghost job detection scores each listing (posting age, repeat postings, link health, company news).
6. Application timing intelligence estimates urgency based on historical close rates.
7. Matched against user profile. Fit scores assigned by Claude.
8. Referral network checked against user's LinkedIn connections.
9. Results appear in web UI jobs board with fit scores, competition estimates, ghost flags, urgency labels, and referral badges.

### 5.3 Application (Per Job, Automated or User-Approved)

1. User sets auto-apply threshold (fit score cutoff) or manually approves jobs from the queue.
2. For each approved job:
   - Claude reads the job description and extracts requirements.
   - Claude selects relevant content from the parsed CV.
   - Claude rewrites bullet points to mirror job description language.
   - Claude fills LaTeX template. PDF is compiled.
   - ATS score preview runs: keyword match percentage, missing keywords, parsability check.
   - If ATS score is below 70%, Claude revises and recompiles (max 2 cycles).
   - Cover letter generated if required (complementary to resume, not repetitive).
   - Custom question answers generated from questionnaire + essay bank.
   - ATS type detected from URL pattern.
   - Browser automation (Playwright) fills and submits the form.
   - CAPTCHA handling: reCAPTCHA/hCaptcha routed to 2Captcha API. Unknown types flagged for manual.
   - If submission fails, flagged for manual completion with pre-filled data and direct link.
3. If recruiter contact available (Apollo), personalized email sent via AgentMail.
4. Application logged. Live feed updates. Google Sheet synced if enabled.

### 5.4 Response Tracking (Continuous, Automated)

1. AgentMail receives inbound emails.
2. Claude classifies: rejection, interview request, info request, auto-reply.
3. For rejections: classified as auto-reject (fast turnaround, ATS screen) or post-review reject. ATS keyword gaps identified for auto-rejects.
4. For interview requests: times extracted, calendar checked, confirmation draft prepared.
5. Dashboard and Google Sheet updated.

### 5.5 Interview Loop (Triggered on Interview Confirmation)

1. User confirms interview time (or system auto-confirms from calendar availability).
2. System generates prep materials (company research, likely questions, talking points).
3. After interview date: user inputs brief notes (who, what was discussed).
4. Claude drafts personalized thank-you email referencing specific discussion points.
5. User reviews and sends via AgentMail.
6. 5 business day timer set. If no response, follow-up email drafted and queued for user approval.
7. All tracked in application row.

### 5.6 Apply from pasted URL (user-initiated)

1. User pastes a URL in the product UI: either a **public job posting** (company careers page, board aggregator link, etc.) or a **direct application** link (e.g. Greenhouse, Lever).
2. System attempts to **fetch and extract** job content: HTML text, `JobPosting` structured data, and Open Graph metadata where available. If fetch is blocked (login wall, bot protection, empty client-rendered shell), user is prompted to **paste the job description text** as fallback; processing continues from that text.
3. Claude normalizes the listing (title, company, location, requirements, optional custom-question prompts visible on the page).
4. The pipeline **reuses the same application steps** as queued jobs: tailored resume, ATS score preview with revision loop, cover letter if indicated, custom answers from questionnaire + essay bank, ATS type detection from URL patterns.
5. Output is an **application preparation kit**: PDFs/links for documents, answer map, ATS score summary, and a **checklist** (required uploads, attestations, any fields the automation could not infer). Browser automation submit runs when the session is accessible; otherwise the row is flagged **manual completion** with the direct link and all pre-filled artifacts—matching the existing failure mode in §5.3.

**Feasibility note:** End-to-end auto-submit from an arbitrary pasted URL is **not guaranteed** (authentication, CAPTCHA, ToS, and dynamic forms vary by site). Delivering **everything needed to apply**—documents, drafts, scoring, and structured handoff—is **in scope** and technically realistic; full unattended submit remains **best-effort** per ATS, consistent with the rest of the product.

---

## 6. Features

### 6.1 Live Application Feed (Home Screen)

Real-time vertical feed showing application events as they happen. Each entry has a timestamp, company, role, and current action. Entries are expandable to show generated resume, cover letter, ATS score, form screenshots. This is the centerpiece of the product.

### 6.2 Jobs Board

All scraped listings with filters: source, company, role type, location, fit score, competition estimate, posting age. Each card shows fit score, competition estimate, ghost flag, timing urgency, referral badge, and status.

### 6.3 Application Tracker

Table view of all applications. Columns: Company, Role, Date Applied, Method, Resume link, Cover Letter link, ATS Score, Status, Response, Days Since Applied, Next Action. Smart "Next Action" column suggests what to do based on current status and elapsed time.

### 6.4 Resume Vault

Every generated resume stored and viewable. User can see what was emphasized for each company. Useful for interview prep.

### 6.5 ATS Score Preview

Pre-submission keyword match analysis. Shows matched keywords, missing keywords, and suggestions. Auto-revision if score is below threshold.

### 6.6 Ghost Job Detection

Probability score based on posting age, repeat postings, link health, and company news. Suspicious listings flagged with reasoning.

### 6.7 Application Timing Intelligence

Historical data on how fast roles fill at each company. Urgency labels on job cards. Fast-closing roles prioritized in the application queue.

### 6.8 Referral Network Mining

Cross-references user's LinkedIn connections against target companies. Surfaces referral paths. Drafts referral request messages. Pauses auto-apply to allow referral-first approach.

### 6.9 Interview Loop Closer

Calendar integration for scheduling. Thank-you email generation. Follow-up timer and auto-drafted check-ins.

### 6.10 Google Sheets Sync (Optional)

Bidirectional sync. Sheet mirrors the application tracker. User can add manual entries. Power users get spreadsheet-level control.

### 6.11 Settings

Auto-apply threshold, daily application limit, template selection, CV/profile editing, essay bank management, integration toggles (Sheets, Calendar, LinkedIn).

### 6.12 Apply from link (URL intake)

Single-field (or form) UX: user submits an application or job-posting URL. Backend resolves text via fetch + structured-data extraction, with JD paste fallback. Produces the same artifacts as pipeline applications (§5.3): tailored resume, optional cover letter, custom-answer drafts, ATS preview, platform detection, tracker row, and live-feed event. Surfaces a completion checklist and manual handoff when the portal cannot be driven automatically.

---

## 7. Success Metrics (Demo Context)

- End-to-end pipeline executes live in under 2 minutes (scrape to submission)
- ATS form fill success rate over 80% for Greenhouse and Lever
- Resume ATS keyword match score over 75% on average
- Ghost job detection correctly flags at least 3 stale/dead listings in demo data
- Referral path detection surfaces at least 1 connection match
- Response classification accuracy over 90%

---

## 8. Out of Scope (For Demo)

- Workday ATS adapter (flagged for manual completion)
- Email deliverability optimization (domain warmup, SPF/DKIM)
- Multi-user peer benchmarking
- Payment/subscription system
- Mobile app
- Full LinkedIn API integration (CSV upload only)

---

## 9. Risk and Mitigations

| Risk | Mitigation |
|------|-----------|
| ATS form changes break adapters | Claude vision fallback for unknown forms. Adapters versioned and monitored. |
| CAPTCHA blocks submissions | 2Captcha integration. Manual fallback queue. |
| GitHub repo format changes | Claude-based parsing instead of rigid regex. Handles format variation. |
| Generated resume contains hallucinated content | Validation pass checks all claims against CV JSON. User review for first N applications. |
| Custom question answers are poor quality | Essay bank provides raw material. Claude adapts, does not fabricate. Flagged for review when confidence is low. |
| Bot detection / IP blocking | Residential proxies. Human-like timing delays between submissions. Rate limiting per ATS platform. |
