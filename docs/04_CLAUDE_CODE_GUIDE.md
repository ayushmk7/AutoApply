# How to Use Your Claude Code Subscription to Build AutoApply

This document is a practical guide for getting the most out of Claude Code (the terminal-based agentic coding tool) when building this project. It assumes you have a Claude Pro or Team subscription with Claude Code access.

---

## 1. Setup

### Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Requires Node.js 18+. After install, run `claude` in your terminal to start.

### Authenticate

```bash
claude auth
```

This opens a browser window. Sign in with your Anthropic account. Your subscription handles the API usage, no separate API key needed for Claude Code itself.

### Project Initialization

Navigate to your project root and run:

```bash
cd ~/autoapply
claude
```

Claude Code reads your project files and understands the codebase context. The first time you run it in a project directory, give it orientation:

```
> Read the project structure and understand what we are building. 
  This is a job application automation platform. Read the PRD files 
  in the docs/ folder for full context.
```

---

## 2. Using Claude Code Effectively for This Project

### 2.1 Let Claude Code scaffold entire modules

Don't write boilerplate yourself. Claude Code can generate full files with context from your PRDs.

Example prompts:

```
> Create the Express server with all the API routes defined in 
  docs/03_BACKEND_PRD.md. Set up Firebase Admin SDK auth middleware. 
  Include the WebSocket server for the live feed. Use TypeScript.

> Create the Playwright adapter for Greenhouse. It should implement 
  the ATSAdapter interface. Handle standard fields (name, email, phone, 
  LinkedIn, resume upload) and detect custom questions. Include CAPTCHA 
  detection.

> Create the BullMQ queue definitions and worker for the apply_to_job 
  workflow. Each step should emit a WebSocket event to the live feed.
```

### 2.2 Use Claude Code for multi-file changes

Claude Code excels at changes that touch many files at once. When you need to add a new feature that involves route + controller + service + queue + types:

```
> Add the interview loop closer feature. This needs:
  1. New routes in routes/interview.ts
  2. Service functions in services/interview.ts
  3. A BullMQ job for the follow-up timer
  4. WebSocket events for feed updates
  5. Firestore reads/writes for application status
  Update all relevant files.
```

### 2.3 Use Claude Code for debugging

When something breaks, paste the error and let Claude Code investigate:

```
> The Greenhouse adapter is failing on this URL: [url]. Here is the 
  error log: [paste error]. Look at the adapter code and the page 
  structure to figure out what changed.
```

Claude Code will read your adapter file, analyze the error, and suggest or make fixes directly.

### 2.4 Use Claude Code for LaTeX template work

LaTeX is tedious to write by hand. Let Claude Code handle it:

```
> Create a Jake's Resume style LaTeX template. It should have 
  placeholder tokens for: name, email, phone, linkedin, github, 
  education section, experience section (variable number of entries), 
  projects section, skills section. Each experience entry has company, 
  role, dates, and 2-4 bullet points. Output should compile to a 
  clean one-page PDF.
```

### 2.5 Use Claude Code for test generation

```
> Write unit tests for the job scraper service. Test:
  - GitHub markdown parsing with different table formats
  - Ghost job detection scoring
  - Listing deduplication
  - Change detection (SHA comparison)
  Use Jest. Mock the GitHub API and Claude API calls.
```

### 2.6 Use Claude Code for Docker and deployment

```
> Create the Dockerfile for the backend. It needs:
  - Node.js 20
  - texlive for LaTeX compilation
  - Playwright with Chromium
  - Build TypeScript
  - Production CMD
  Also create the docker-compose.yml for local dev with Redis.
```

---

## 3. Claude Code Workflows for This Project

### 3.1 Building the Backend (Recommended Order)

Start each session by telling Claude Code what you are working on:

```
> I am building the backend for AutoApply. Today I am working on 
  [specific module]. The PRDs are in docs/. Let me know if you need 
  to read any of them for context.
```

**Session 1: Project scaffolding**
```
> Initialize a TypeScript Node.js project with Express. Set up:
  - tsconfig.json
  - ESLint
  - Project directory structure (routes/, services/, queues/, 
    playwright/, templates/, middleware/, types/)
  - Firebase Admin SDK initialization
  - Auth middleware
  - Basic server with health check endpoint
```

**Session 2: Database and models**
```
> Create Firestore service with all CRUD operations for:
  - User profiles (including nested CV JSON)
  - Job listings
  - Applications
  Define TypeScript interfaces matching the data models in the 
  technical PRD.
```

**Session 3: Scraping pipeline**
```
> Build the GitHub job scraper. It should:
  - Fetch raw markdown from configured repos via GitHub API
  - Send to Claude API for structured parsing
  - Diff against existing listings in Firestore
  - Run ghost detection scoring
  - Calculate timing urgency from historical data
  - Store results
  Make it runnable as a BullMQ job on a cron schedule.
```

**Session 4: Resume generation**
```
> Build the resume generation pipeline:
  - Claude API call to select relevant CV content for a job
  - Claude API call to generate LaTeX content
  - LaTeX compilation to PDF
  - pdftotext extraction for ATS scoring
  - ATS keyword matching logic
  - Revision loop if score is low
  Wire it up as a service that the apply queue can call.
```

**Session 5: Playwright adapters**
```
> Build the Playwright automation layer:
  - ATSAdapter interface
  - URL pattern detector
  - Greenhouse adapter (full implementation)
  - Lever adapter
  - Generic fallback using Claude vision
  - CAPTCHA detection and 2Captcha integration
  - Screenshot capture at each stage
```

**Session 6: AgentMail and email**
```
> Build the AgentMail integration:
  - Agent email creation during onboarding
  - Outbound email sending (with resume attachment)
  - Inbound webhook handler
  - Response classification via Claude
  - Application status updates based on classification
```

**Session 7: Google Sheets and Calendar**
```
> Build the Google integrations:
  - OAuth flow for Sheets and Calendar
  - Sheet creation with header row
  - Row append on new application
  - Row update on status change
  - Bidirectional sync job
  - Calendar availability check
  - Calendar event creation for interviews
```

**Session 8: WebSocket and live feed**
```
> Build the real-time feed:
  - WebSocket server with auth (token in query param)
  - Event emitter that all services can call
  - Event types for every pipeline step
  - REST fallback endpoint for feed history
  - Client reconnection handling
```

### 3.2 Building the Frontend

```
> I am building the React frontend for AutoApply. Use Next.js 14+ 
  with App Router. Tailwind for styling. The design should follow 
  the prompt in docs/05_FRONTEND_PROMPT.md.
```

Then build page by page:

```
> Build the landing page based on the frontend prompt spec.
> Build the login/register page with Firebase client auth.
> Build the onboarding flow (CV upload, questionnaire, template selection).
> Build the live application feed (home screen) with WebSocket connection.
> Build the jobs board with filters and job cards.
> Build the application tracker table.
> Build the resume vault.
> Build the settings page.
```

---

## 4. Tips for Maximum Productivity

### 4.1 Use /commands

Claude Code supports slash commands:

- `/compact` - Compresses conversation history to save context window space. Use this when conversations get long.
- `/clear` - Clears conversation history entirely. Use between major sessions.
- `/init` - Generates a CLAUDE.md project file that helps Claude Code understand your project across sessions.

### 4.2 Create a CLAUDE.md

After your first session, run `/init` to create a CLAUDE.md file. Edit it to include:

```markdown
# AutoApply

## What This Is
Job application automation platform built on OpenClaw. See docs/ for PRDs.

## Tech Stack
- Backend: Node.js, TypeScript, Express, Firebase, BullMQ, Playwright
- Frontend: Next.js 14, React, Tailwind
- AI: Claude API (Sonnet), OpenClaw workflows
- External: AgentMail, Apollo.io, GitHub API, Google Sheets/Calendar, 2Captcha

## Key Directories
- /backend - API server, workers, Playwright adapters
- /frontend - Next.js app
- /docs - PRDs and documentation
- /templates - LaTeX resume templates

## Conventions
- TypeScript strict mode
- Functional components with hooks (React)
- Services pattern (routes -> services -> external calls)
- All async errors caught and logged
- WebSocket events emitted from services, not routes
```

This file persists across sessions and gives Claude Code baseline context every time.

### 4.3 Use Claude Code for code review

Before committing, ask Claude Code to review:

```
> Review the changes I made today. Check for:
  - Security issues (exposed secrets, missing auth checks)
  - Error handling gaps
  - Type safety issues
  - Performance concerns
  - Anything that contradicts the PRD
```

### 4.4 Use Claude Code to write commit messages

```
> Look at the git diff and write a commit message for what I changed.
```

### 4.5 Use Claude Code for documentation

```
> Generate API documentation for all the routes in routes/. 
  Include request/response examples. Output as a markdown file.
```

---

## 5. Cost and Rate Limits

With a Claude Pro subscription, Claude Code usage is included. However, long sessions with large context windows consume more quota. To manage this:

- Use `/compact` regularly to compress context
- Start new sessions (`/clear`) when switching between unrelated tasks
- Avoid pasting massive files directly. Instead, tell Claude Code to read them: "Read the file at services/scraper.ts"
- Break large tasks into focused sessions rather than one marathon session

---

## 6. MCP Servers in Claude Code

Claude Code supports MCP servers for direct tool access. You can configure these in your Claude Code settings to give Claude Code direct access to your project's services during development:

```json
// ~/.claude/mcp_servers.json
{
  "servers": [
    {
      "name": "firebase",
      "command": "npx",
      "args": ["-y", "firebase-mcp-server"]
    }
  ]
}
```

This lets Claude Code interact with your Firebase project directly during development (reading Firestore documents, checking auth configs, etc.).

---

## 7. Recommended Session Flow

1. Open terminal in project root.
2. Run `claude`.
3. Tell it what you are working on today.
4. Reference the relevant PRD doc if needed.
5. Build in focused increments (one module or feature per prompt).
6. Test as you go (ask Claude Code to run tests or start the dev server).
7. Use `/compact` if the conversation gets long.
8. Review changes before committing.
9. `/clear` when switching to a different part of the project.
