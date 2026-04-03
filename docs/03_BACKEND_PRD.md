# AutoApply - Backend Product Requirements Document

**Project:** OpenClaw Demo - Automated College Internship & Job Application Platform
**Version:** 1.0
**Date:** April 2026

---

## 1. Backend Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20+ | TypeScript |
| Framework | Express.js | REST API + WebSocket |
| Auth | Firebase Auth | Email/password + Google OAuth |
| Database | Firebase Firestore | NoSQL document store |
| File Storage | Google Cloud Storage (GCS) | Resume PDFs, screenshots, cover letters |
| WebSocket | ws (npm package) | Live feed real-time updates |
| Task Queue | BullMQ + Redis | Job queue for application workflows |
| Browser Automation | Playwright | Headless Chromium in Docker |
| LaTeX | texlive (Docker) | Resume PDF compilation |
| Orchestration | OpenClaw SDK | Workflow definitions and execution |

---

## 2. Firebase Auth - Full Implementation

### 2.1 Firebase Project Setup

1. Create Firebase project in Firebase Console.
2. Enable Authentication providers: Email/Password and Google.
3. Generate service account key JSON for backend (Admin SDK).
4. Set up Firebase config for frontend (public config object).

### 2.2 Backend Auth Middleware

The API server uses Firebase Admin SDK to verify ID tokens on every request.

```typescript
// firebase-admin.ts
import admin from 'firebase-admin';
import serviceAccount from './service-account-key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'autoapply-demo.appspot.com'
});

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
```

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebase-admin';

export interface AuthRequest extends Request {
  uid: string;
  email: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.split('Bearer ')[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    (req as AuthRequest).uid = decoded.uid;
    (req as AuthRequest).email = decoded.email || '';
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

### 2.3 Frontend Auth Flow

```typescript
// firebase-client.ts (frontend)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const clientAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### 2.4 Auth Flows

**Email/Password Registration:**
1. Frontend calls `createUserWithEmailAndPassword(auth, email, password)`
2. Firebase returns user object with UID
3. Frontend gets ID token via `user.getIdToken()`
4. Frontend sends token in Authorization header on all API calls
5. Backend verifies token, extracts UID, creates Firestore user document

**Google OAuth:**
1. Frontend calls `signInWithPopup(auth, googleProvider)`
2. Same flow as above from step 2 onward

**Session Management:**
- Frontend uses `onAuthStateChanged` listener to track auth state
- Token refresh is automatic (Firebase SDK handles it)
- Backend does not store sessions. Every request is stateless token verification.

**Logout:**
- Frontend calls `signOut(auth)`
- Frontend clears local state
- No backend call needed

### 2.5 Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      // Applications subcollection
      match /applications/{appId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Listings are readable by any authenticated user
    match /listings/{listingId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend service account writes
    }
  }
}
```

Note: In practice, all Firestore reads/writes go through the backend API using the Admin SDK (which bypasses security rules). The rules above are a safety net for any direct client access.

---

## 3. API Routes

### 3.1 Auth Routes

```
POST   /api/auth/register        - Create user profile after Firebase registration
POST   /api/auth/skip             - Create anonymous/demo session (no Firebase, demo mode)
```

**POST /api/auth/register**
- Auth: Required (Firebase token)
- Body: `{ email: string }`
- Action: Creates Firestore user document with empty profile
- Response: `{ uid: string, created: true }`

**POST /api/auth/skip**
- Auth: None
- Action: Creates a temporary demo user with pre-loaded sample data
- Response: `{ demo_uid: string, token: string (short-lived) }`
- Note: This is for the frontend demo. No Firebase auth. Generates a temporary token the backend recognizes.

### 3.2 Profile Routes

```
GET    /api/profile               - Get current user profile
PUT    /api/profile               - Update profile (questionnaire, preferences)
POST   /api/profile/cv            - Upload and parse CV
PUT    /api/profile/cv            - Update parsed CV data (user corrections)
POST   /api/profile/linkedin      - Upload LinkedIn connections CSV
PUT    /api/profile/preferences   - Update preferences (thresholds, toggles)
```

**POST /api/profile/cv**
- Auth: Required
- Body: `multipart/form-data` with CV file (PDF or DOCX)
- Action:
  1. Store raw file in GCS: `users/{uid}/cv/original.{ext}`
  2. Extract text (pdftotext for PDF, pandoc for DOCX)
  3. Send to Claude for structured parsing
  4. Store parsed JSON in Firestore: `users/{uid}/profile.cv`
  5. Return parsed JSON for user review
- Response: `{ parsed_cv: CVStructuredJSON }`

**POST /api/profile/linkedin**
- Auth: Required
- Body: `multipart/form-data` with CSV file
- Action:
  1. Parse CSV (name, company, position columns)
  2. Normalize company names via Claude
  3. Store in Firestore: `users/{uid}/profile.preferences.linkedin_connections`
- Response: `{ connections_count: number }`

### 3.3 Job Routes

```
GET    /api/jobs                  - List jobs (with filters)
GET    /api/jobs/:id              - Get single job details
POST   /api/jobs/:id/approve      - Manually approve job for application
POST   /api/jobs/:id/skip         - Skip job
GET    /api/jobs/stats             - Aggregated stats (total scraped, ghosts, etc.)
```

**GET /api/jobs**
- Auth: Required
- Query params: `source`, `company`, `location`, `min_fit_score`, `max_ghost_score`, `status`, `has_referral`, `sort_by`, `page`, `limit`
- Action: Query Firestore listings collection with filters. Join with user's application data to show per-job status.
- Response: `{ jobs: JobListing[], total: number, page: number }`

### 3.4 Application Routes

```
GET    /api/applications                    - List all applications
GET    /api/applications/:id                - Get application detail
GET    /api/applications/:id/resume         - Get generated resume PDF URL
GET    /api/applications/:id/cover-letter   - Get cover letter PDF URL
GET    /api/applications/:id/screenshot     - Get submission screenshot URL
POST   /api/applications/:id/retry          - Retry failed application
POST   /api/applications/:id/manual-done    - Mark manual application as completed
PUT    /api/applications/:id/notes          - Update user notes
```

**GET /api/applications**
- Auth: Required
- Query params: `status`, `method`, `sort_by`, `page`, `limit`
- Response: `{ applications: Application[], total: number }`

### 3.5 Interview Routes

```
POST   /api/applications/:id/confirm-interview   - Confirm interview time
GET    /api/applications/:id/prep                  - Get interview prep materials
POST   /api/applications/:id/interview-notes       - Submit post-interview notes
POST   /api/applications/:id/send-thankyou         - Approve and send thank-you email
POST   /api/applications/:id/send-followup         - Approve and send follow-up email
```

**POST /api/applications/:id/confirm-interview**
- Auth: Required
- Body: `{ selected_time: string (ISO datetime) }`
- Action:
  1. Draft confirmation email via Claude
  2. Send via AgentMail
  3. If Google Calendar connected, create event
  4. Update application status to `interview_scheduled`
- Response: `{ confirmation_sent: true, calendar_event_created: boolean }`

### 3.6 Feed Routes

```
GET    /api/feed                  - Get recent feed events (REST fallback)
WS     /ws/feed                   - WebSocket connection for live feed
```

**WebSocket /ws/feed**
- Auth: Token passed as query param on connection: `/ws/feed?token={firebase_id_token}`
- Events sent to client:

```json
{
  "type": "application_event",
  "data": {
    "application_id": "string",
    "company": "string",
    "role": "string",
    "action": "generating_resume|compiling_pdf|ats_scoring|filling_form|captcha_solving|submitted|failed|emailed|response_received|ghost_detected|referral_found",
    "detail": "string (human readable)",
    "timestamp": "ISO string",
    "metadata": {}
  }
}
```

### 3.7 Sheets Sync Routes

```
POST   /api/sheets/enable         - Create or connect Google Sheet
POST   /api/sheets/disable        - Disconnect Google Sheet
POST   /api/sheets/sync           - Force full sync
GET    /api/sheets/status          - Sync status and last sync time
```

### 3.8 Webhook Routes

```
POST   /api/webhooks/agentmail    - Inbound email webhook from AgentMail
```

**POST /api/webhooks/agentmail**
- Auth: Webhook signature verification (shared secret)
- Body: AgentMail webhook payload (sender, subject, body, headers, attachments)
- Action:
  1. Identify which user this email is for (by agent email address)
  2. Match to existing application (by sender domain or thread)
  3. Trigger `process_response` workflow
- Response: `200 OK`

---

## 4. Task Queue (BullMQ)

Long-running tasks (application submission, scraping) run in background workers, not in request handlers.

### 4.1 Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `scrape` | GitHub repo fetching and parsing | 1 (sequential) |
| `match` | Job scoring against user profiles | 5 |
| `apply` | Full application submission pipeline | 3 (rate limited) |
| `email` | AgentMail outbound sends | 5 |
| `classify` | Inbound email classification | 5 |
| `compile` | LaTeX to PDF compilation | 2 |

### 4.2 Job Definitions

```typescript
// queues/apply.ts
interface ApplyJobData {
  user_id: string;
  listing_id: string;
  profile: ProfileJSON;
  listing: JobListing;
}

// Each step in the apply workflow emits a WebSocket event to the live feed
async function processApplication(job: Job<ApplyJobData>) {
  const { user_id, listing_id, profile, listing } = job.data;

  emitFeedEvent(user_id, listing, 'analyzing_job');
  const analysis = await analyzeJob(listing.description);

  emitFeedEvent(user_id, listing, 'generating_resume');
  const latex = await generateResume(profile.cv, analysis);

  emitFeedEvent(user_id, listing, 'compiling_pdf');
  const pdfPath = await compileLaTeX(latex, profile.preferences.resume_template);

  emitFeedEvent(user_id, listing, 'ats_scoring');
  const atsScore = await scoreATS(pdfPath, analysis.keywords);
  // ... continue pipeline
}
```

### 4.3 Rate Limiting

Applications are rate limited per user and globally:
- Per user: max `daily_limit` applications per 24 hours (default 20)
- Per ATS domain: max 5 submissions per hour to the same ATS platform
- Global: max 50 concurrent Playwright browsers

---

## 5. LaTeX Resume Compilation

### 5.1 Docker Setup

The backend runs in a Docker container with texlive installed:

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "dist/server.js"]
```

### 5.2 Template System

Templates are stored as `.tex` files with placeholder tokens:

```
templates/
  jakes.tex          -- Jake's Resume template (clean, minimal)
  sidebar.tex        -- Two-column with skills sidebar
  minimal.tex        -- Maximum whitespace, elegant
```

Claude generates content that fills the template structure. The compilation pipeline:

1. Claude outputs structured resume content (sections, bullets, skills)
2. Backend injects content into LaTeX template placeholders
3. `pdflatex` compiles to PDF
4. `pdftotext` extracts text for ATS score verification
5. PDF stored in GCS: `users/{uid}/resumes/{application_id}.pdf`

### 5.3 Compilation Error Handling

LaTeX compilation can fail if Claude produces malformed content (unescaped special characters, bad formatting). Handling:

1. First attempt: compile as-is
2. If fails: run a sanitization pass (escape `&`, `%`, `$`, `#`, `_`, `{`, `}`)
3. If still fails: send error log to Claude, ask for corrected LaTeX
4. If still fails: flag application for manual resume upload

---

## 6. Playwright Service

### 6.1 Architecture

Playwright runs in the same Docker container as the backend (or in a separate container if scaling is needed). Each application submission gets its own browser context.

```typescript
// playwright/manager.ts
import { chromium, Browser, BrowserContext } from 'playwright';

class PlaywrightManager {
  private browser: Browser;
  private activeContexts: number = 0;
  private maxContexts: number = 10;

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async createContext(): Promise<BrowserContext> {
    if (this.activeContexts >= this.maxContexts) {
      throw new Error('Max browser contexts reached');
    }
    this.activeContexts++;
    const context = await this.browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1280, height: 720 },
    });
    return context;
  }

  async destroyContext(context: BrowserContext) {
    await context.close();
    this.activeContexts--;
  }
}
```

### 6.2 Adapter Registry

```typescript
// playwright/adapters/index.ts
import { GreenhouseAdapter } from './greenhouse';
import { LeverAdapter } from './lever';
import { GenericAdapter } from './generic';

const adapters = [
  new GreenhouseAdapter(),
  new LeverAdapter(),
  // add more adapters here
];

export function getAdapter(url: string): ATSAdapter {
  for (const adapter of adapters) {
    if (adapter.detect(url)) return adapter;
  }
  return new GenericAdapter(); // Claude vision fallback
}
```

### 6.3 Screenshot Capture

Every submission attempt captures:
- Pre-fill screenshot (empty form)
- Post-fill screenshot (before submit)
- Post-submit screenshot (confirmation page or error)

Stored in GCS: `users/{uid}/screenshots/{application_id}_{stage}.png`

---

## 7. AgentMail Integration

### 7.1 User Setup

During onboarding, the backend creates a per-user agent email address:

```typescript
// agentmail/setup.ts
async function createAgentEmail(uid: string, userName: string): Promise<string> {
  const response = await agentmailClient.post('/addresses', {
    name: userName,
    prefix: `applicant-${uid.slice(0, 8)}`,
    webhook_url: `${API_BASE_URL}/api/webhooks/agentmail`,
  });
  return response.data.email; // e.g. applicant-a1b2c3d4@agentmail.dev
}
```

### 7.2 Outbound Email

```typescript
async function sendOutreach(agentEmail: string, to: string, subject: string, body: string, attachments: Buffer[]) {
  await agentmailClient.post('/send', {
    from: agentEmail,
    to: to,
    subject: subject,
    body: body,
    attachments: attachments.map(buf => ({
      filename: 'resume.pdf',
      content: buf.toString('base64'),
      contentType: 'application/pdf'
    }))
  });
}
```

### 7.3 Inbound Webhook Processing

```typescript
// routes/webhooks.ts
router.post('/agentmail', verifyWebhookSignature, async (req, res) => {
  const { to, from, subject, body } = req.body;

  // Find user by agent email address
  const user = await findUserByAgentEmail(to);
  if (!user) return res.status(404).send();

  // Find matching application by sender domain
  const application = await matchApplicationBySender(user.uid, from);

  // Queue classification
  await classifyQueue.add('classify', {
    user_id: user.uid,
    application_id: application?.id,
    email: { from, subject, body }
  });

  res.status(200).send();
});
```

---

## 8. Google Sheets Sync

### 8.1 OAuth Flow

1. User clicks "Enable Google Sheets" in settings.
2. Frontend redirects to Google OAuth consent screen (scope: `spreadsheets`).
3. Backend receives auth code, exchanges for access/refresh tokens.
4. Tokens stored encrypted in Firestore: `users/{uid}/tokens/google`

### 8.2 Sheet Operations

```typescript
// sheets/sync.ts
import { google } from 'googleapis';

async function createTrackingSheet(tokens: GoogleTokens, userEmail: string): Promise<string> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'AutoApply - Application Tracker' },
      sheets: [{
        properties: { title: 'Applications' },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: [
              { userEnteredValue: { stringValue: 'Company' } },
              { userEnteredValue: { stringValue: 'Role' } },
              { userEnteredValue: { stringValue: 'Location' } },
              { userEnteredValue: { stringValue: 'Source' } },
              { userEnteredValue: { stringValue: 'Fit Score' } },
              { userEnteredValue: { stringValue: 'ATS Score' } },
              { userEnteredValue: { stringValue: 'Status' } },
              { userEnteredValue: { stringValue: 'Method' } },
              { userEnteredValue: { stringValue: 'Resume Link' } },
              { userEnteredValue: { stringValue: 'Cover Letter Link' } },
              { userEnteredValue: { stringValue: 'Applied Date' } },
              { userEnteredValue: { stringValue: 'Response' } },
              { userEnteredValue: { stringValue: 'Response Date' } },
              { userEnteredValue: { stringValue: 'Next Action' } },
              { userEnteredValue: { stringValue: 'Notes' } },
            ]
          }]
        }]
      }]
    }
  });

  return response.data.spreadsheetId;
}

async function appendApplicationRow(sheetId: string, tokens: GoogleTokens, app: Application) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Applications!A:O',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        app.company,
        app.role,
        app.location,
        app.source,
        app.fit_score,
        app.ats_score,
        app.status,
        app.method,
        app.resume_url,
        app.cover_letter_url,
        app.applied_date,
        app.response_type || '',
        app.response_date || '',
        getNextAction(app),
        app.notes || '',
      ]]
    }
  });
}
```

### 8.3 Bidirectional Sync

A periodic job (every 15 minutes) reads the sheet for manual additions:

1. Read all rows from sheet.
2. Compare against Firestore applications.
3. New rows not in Firestore = manually added by user. Import them with status `manual`.
4. Changed status values in sheet = user updated manually. Sync to Firestore.

---

## 9. Environment Variables

```env
# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_STORAGE_BUCKET=

# Claude
ANTHROPIC_API_KEY=

# AgentMail
AGENTMAIL_API_KEY=
AGENTMAIL_WEBHOOK_SECRET=

# Apollo
APOLLO_API_KEY=

# GitHub
GITHUB_TOKEN=

# 2Captcha
TWOCAPTCHA_API_KEY=

# Google OAuth (for Sheets/Calendar)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Redis (for BullMQ)
REDIS_URL=

# Server
PORT=3000
NODE_ENV=production
API_BASE_URL=https://api.autoapply.dev
FRONTEND_URL=https://autoapply.dev
```

---

## 10. Deployment

### 10.1 Docker Compose (Development)

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - redis
    volumes:
      - ./templates:/app/templates

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  worker:
    build: .
    command: node dist/worker.js
    env_file: .env
    depends_on:
      - redis
```

### 10.2 Production

- API + Worker deployed as separate Railway services sharing the same Redis instance.
- Playwright container may need separate deployment with more memory (2GB+ recommended).
- GCS bucket configured with lifecycle rules to auto-delete screenshots older than 90 days.
- Firebase emulators used for local development.
