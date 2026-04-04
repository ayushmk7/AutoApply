import 'dotenv/config';
import { z } from 'zod';

function boolFromEnv(defaultFalse: boolean): z.ZodType<boolean, z.ZodTypeDef, unknown> {
  return z.preprocess((val) => {
    if (val === undefined || val === '') return defaultFalse;
    if (typeof val === 'boolean') return val;
    const s = String(val).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'off'].includes(s)) return false;
    return defaultFalse;
  }, z.boolean());
}

function trimToUndef(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t || undefined;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    /** Liveness/readiness listen path host binding (Phase 19 Docker). */
    HOST: z.string().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    API_BASE_URL: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v),
      z.string().url().optional()
    ),
    FRONTEND_URL: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v),
      z.string().url().optional()
    ),
    REDIS_URL: z.string().url().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z
      .string()
      .optional()
      .transform((k) => (k ? k.replace(/\\n/g, '\n') : undefined)),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
    GCS_BUCKET: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    AGENTMAIL_API_KEY: z.string().optional(),
    AGENTMAIL_WEBHOOK_SECRET: z.string().optional(),
    APOLLO_API_KEY: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    CAPTCHA_2CAPTCHA_KEY: z.string().optional(),
    MOCK_AGENTMAIL: boolFromEnv(false),
    MOCK_CLASSIFY_INBOUND_EMAIL: boolFromEnv(false),
    ENABLE_DEMO_SKIP: boolFromEnv(false),
    DEMO_JWT_SECRET: z.string().optional(),
    DEMO_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(86400),
    /** Comma-separated `owner/repo` entries (Phase 5.2). */
    GITHUB_SCRAPE_REPOS: z.string().optional(),
    /** BullMQ repeatable scrape interval (Phase 5.6); default 3 hours. */
    SCRAPE_INTERVAL_MS: z.coerce.number().int().min(600_000).max(86_400_000).default(10_800_000),
    SCRAPE_JOB_BACKOFF_DELAY_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(120_000),
    /** AgentMail REST base URL; path `/v1/addresses` appended in client (Phase 4.6 / PRD). */
    AGENTMAIL_API_BASE: z.string().url().default('https://api.agentmail.dev'),
    /** AES-256-GCM key as 64 hex chars — encrypts Google OAuth tokens at rest (Phase 15). */
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .optional()
      .transform((s) => (s?.trim() ? s.trim() : undefined))
      .refine((s) => !s || /^[0-9a-fA-F]{64}$/.test(s), {
        message: 'TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters',
      }),
    /** Google OAuth redirect for Sheets (defaults to `${API_BASE_URL}/api/sheets/oauth/callback`). */
    GOOGLE_SHEETS_REDIRECT_URI: z.string().url().optional(),
    /** HS256 secret for OAuth `state` JWT (Phase 15); defaults to DEMO_JWT_SECRET in non-production. */
    OAUTH_STATE_SECRET: z.string().optional(),
    /** Max concurrent Playwright browser contexts cluster-wide (Phase 16). */
    PLAYWRIGHT_MAX_CONTEXTS: z.coerce.number().int().min(1).max(100).default(50),
    /** Max apply submissions per ATS registrable domain per UTC hour (Phase 16). */
    ATS_DOMAIN_HOURLY_CAP: z.coerce.number().int().min(1).max(100).default(5),
    /** Stricter caps when `users/{uid}.is_demo` (Phase 16). */
    DEMO_DAILY_APPLY_CAP: z.coerce.number().int().min(1).max(50).default(5),
    DEMO_ATS_DOMAIN_HOURLY_CAP: z.coerce.number().int().min(1).max(20).default(2),
    DEMO_PLAYWRIGHT_MAX_CONTEXTS: z.coerce.number().int().min(1).max(20).default(2),
    PLAYWRIGHT_SLOT_WAIT_MS_STEP: z.coerce.number().int().min(50).max(5000).default(250),
    PLAYWRIGHT_SLOT_WAIT_MAX_MS: z.coerce.number().int().min(5000).max(600_000).default(120_000),
    ATS_DOMAIN_QUOTA_TTL_MS: z.coerce.number().int().min(60_000).max(7_200_000).default(3_600_000),
    /** Extra ms after UTC midnight for Redis daily quota key expiry (Phase 16). */
    DAILY_QUOTA_REDIS_TTL_BUFFER_MS: z.coerce.number().int().min(0).max(86_400_000).default(3_600_000),
    /** Placeholder listing URL when intake is JD-only (Phase 10). Must be a non-routable https URL you control via env. */
    MANUAL_PLACEHOLDER_JOB_URL: z.string().url().default('https://autoapply.invalid/manual-paste'),
    /** Profile fallbacks when fields are missing (Phase 4 / 6). */
    DEFAULT_PROFILE_DAILY_LIMIT: z.coerce.number().int().min(1).max(500).default(20),
    DEFAULT_AUTO_APPLY_THRESHOLD: z.coerce.number().int().min(0).max(100).default(75),
    /** Phase 8.4 — target ATS score before stopping revision loop. */
    ATS_TARGET_SCORE_PERCENT: z.coerce.number().int().min(1).max(100).default(70),
    ATS_REVISION_MAX_LOOPS: z.coerce.number().int().min(0).max(10).default(2),
    /** In-process cap when Redis is unset (Phase 9.1 / 16). */
    PLAYWRIGHT_LOCAL_CONTEXT_CAP: z.coerce.number().int().min(1).max(50).default(15),
    PLAYWRIGHT_PAGE_GOTO_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300_000).default(60_000),
    PLAYWRIGHT_USER_AGENT: z.string().min(8).default(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ),
    SKIP_AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(900_000),
    SKIP_AUTH_RATE_LIMIT_MAX_PROD: z.coerce.number().int().min(1).max(1000).default(20),
    SKIP_AUTH_RATE_LIMIT_MAX_DEV: z.coerce.number().int().min(1).max(10_000).default(100),
    APPLICATION_RETRY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(900_000),
    APPLICATION_RETRY_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(500).default(30),
    AGENTMAIL_WEBHOOK_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
    AGENTMAIL_WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100_000).default(600),
    /** If set, `GET /api/metrics` requires `X-Metrics-Key` match (Phase 17). */
    METRICS_API_KEY: z.string().optional(),
    LISTINGS_QUERY_MAX_DOCS: z.coerce.number().int().min(50).max(5000).default(500),
    BULLMQ_REMOVE_ON_COMPLETE: z.coerce.number().int().min(0).max(10_000).default(500),
    BULLMQ_REMOVE_ON_FAIL: z.coerce.number().int().min(0).max(10_000).default(200),
    DEFAULT_LISTING_URGENCY_SCORE: z.coerce.number().int().min(0).max(100).default(50),
    DEFAULT_LISTING_URGENCY_LABEL: z.enum(['low', 'medium', 'high']).default('medium'),
    /** Phase 10.3–10.4 — minimum Claude extraction confidence before requiring JD paste. */
    EXTRACTION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;

    const hasFirebaseInline =
      trimToUndef(data.FIREBASE_PROJECT_ID) &&
      trimToUndef(data.FIREBASE_CLIENT_EMAIL) &&
      trimToUndef(data.FIREBASE_PRIVATE_KEY);
    const hasFirebaseFile =
      trimToUndef(data.FIREBASE_SERVICE_ACCOUNT_PATH) ||
      trimToUndef(data.FIREBASE_SERVICE_ACCOUNT_JSON) ||
      trimToUndef(data.FIREBASE_SERVICE_ACCOUNT_BASE64);
    if (!hasFirebaseInline && !hasFirebaseFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Production requires Firebase credentials: either FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or FIREBASE_SERVICE_ACCOUNT_PATH / FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_BASE64',
        path: ['FIREBASE_PROJECT_ID'],
      });
    }

    if (data.ENABLE_DEMO_SKIP && !trimToUndef(data.DEMO_JWT_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DEMO_JWT_SECRET is required when ENABLE_DEMO_SKIP is true in production',
        path: ['DEMO_JWT_SECRET'],
      });
    }

    const need = (field: keyof typeof data, message: string) => {
      const raw = data[field];
      const ok = typeof raw === 'string' && raw.trim().length > 0;
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [field as string],
        });
      }
    };

    need('API_BASE_URL', 'API_BASE_URL is required in production');
    need('FRONTEND_URL', 'FRONTEND_URL is required in production');
    need('REDIS_URL', 'REDIS_URL is required in production');

    if (hasFirebaseInline) {
      need('FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID is required in production (your Firebase project)');
      need('FIREBASE_CLIENT_EMAIL', 'FIREBASE_CLIENT_EMAIL is required in production (service account)');
      need('FIREBASE_PRIVATE_KEY', 'FIREBASE_PRIVATE_KEY is required in production (service account)');
    }

    need('GCS_BUCKET', 'GCS_BUCKET is required in production (your GCS bucket)');

    need('ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY is required in production (your Anthropic key)');
    need('AGENTMAIL_API_KEY', 'AGENTMAIL_API_KEY is required in production (your AgentMail key)');
    need(
      'AGENTMAIL_WEBHOOK_SECRET',
      'AGENTMAIL_WEBHOOK_SECRET is required in production (your webhook signing secret)'
    );
    need('APOLLO_API_KEY', 'APOLLO_API_KEY is required in production (your Apollo.io key)');
    need('GITHUB_TOKEN', 'GITHUB_TOKEN is required in production (your GitHub PAT for scraping)');
    need(
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_ID is required in production (your Google OAuth client)'
    );
    need(
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_CLIENT_SECRET is required in production (your Google OAuth client)'
    );
    need(
      'TOKEN_ENCRYPTION_KEY',
      'TOKEN_ENCRYPTION_KEY is required in production (64 hex chars) for Google token encryption'
    );
    need(
      'OAUTH_STATE_SECRET',
      'OAUTH_STATE_SECRET is required in production for Google OAuth state signing'
    );
    need('CAPTCHA_2CAPTCHA_KEY', 'CAPTCHA_2CAPTCHA_KEY is required in production (your 2Captcha key)');

    if (data.MOCK_AGENTMAIL || data.MOCK_CLASSIFY_INBOUND_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'MOCK_AGENTMAIL and MOCK_CLASSIFY_INBOUND_EMAIL must be false in production',
      });
    }
  })
  .superRefine((data, ctx) => {
    const demoAuthActive =
      data.NODE_ENV !== 'production' || data.ENABLE_DEMO_SKIP;
    if (
      demoAuthActive &&
      data.NODE_ENV !== 'test' &&
      !trimToUndef(data.DEMO_JWT_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'DEMO_JWT_SECRET is required when demo auth is available (development, or ENABLE_DEMO_SKIP in production). Use NODE_ENV=test for automated tests without demo auth.',
        path: ['DEMO_JWT_SECRET'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const e = parsed.data;

const demoJwtSecretResolved = trimToUndef(e.DEMO_JWT_SECRET);
const devApiFallback = 'http://localhost:3001';
const devFrontendFallback = 'http://localhost:5173';

export const config = {
  host: trimToUndef(e.HOST),
  nodeEnv: e.NODE_ENV,
  port: e.PORT,
  logLevel: e.LOG_LEVEL,
  apiBaseUrl: trimToUndef(e.API_BASE_URL) ?? (e.NODE_ENV === 'production' ? '' : devApiFallback),
  frontendUrl:
    trimToUndef(e.FRONTEND_URL) ?? (e.NODE_ENV === 'production' ? '' : devFrontendFallback),
  redisUrl: trimToUndef(e.REDIS_URL),
  firebaseProjectId: trimToUndef(e.FIREBASE_PROJECT_ID),
  firebaseClientEmail: trimToUndef(e.FIREBASE_CLIENT_EMAIL),
  firebasePrivateKey: e.FIREBASE_PRIVATE_KEY ? e.FIREBASE_PRIVATE_KEY.trim() || undefined : undefined,
  firebaseServiceAccountPath: trimToUndef(e.FIREBASE_SERVICE_ACCOUNT_PATH),
  firebaseServiceAccountJson: trimToUndef(e.FIREBASE_SERVICE_ACCOUNT_JSON),
  firebaseServiceAccountBase64: trimToUndef(e.FIREBASE_SERVICE_ACCOUNT_BASE64),
  gcsBucket: trimToUndef(e.GCS_BUCKET),
  anthropicApiKey: trimToUndef(e.ANTHROPIC_API_KEY),
  agentmailApiKey: trimToUndef(e.AGENTMAIL_API_KEY),
  agentmailWebhookSecret: trimToUndef(e.AGENTMAIL_WEBHOOK_SECRET),
  apolloApiKey: trimToUndef(e.APOLLO_API_KEY),
  githubToken: trimToUndef(e.GITHUB_TOKEN),
  googleOauthClientId: trimToUndef(e.GOOGLE_OAUTH_CLIENT_ID),
  googleOauthClientSecret: trimToUndef(e.GOOGLE_OAUTH_CLIENT_SECRET),
  captcha2CaptchaKey: trimToUndef(e.CAPTCHA_2CAPTCHA_KEY),
  mockAgentmail: e.MOCK_AGENTMAIL,
  mockClassifyInboundEmail: e.MOCK_CLASSIFY_INBOUND_EMAIL,
  enableDemoSkip: e.ENABLE_DEMO_SKIP,
  demoJwtSecret: demoJwtSecretResolved,
  demoTokenTtlSeconds: e.DEMO_TOKEN_TTL_SECONDS,
  githubScrapeReposRaw: trimToUndef(e.GITHUB_SCRAPE_REPOS),
  scrapeIntervalMs: e.SCRAPE_INTERVAL_MS,
  scrapeJobBackoffDelayMs: e.SCRAPE_JOB_BACKOFF_DELAY_MS,
  agentmailApiBase: e.AGENTMAIL_API_BASE,
  tokenEncryptionKeyHex: trimToUndef(e.TOKEN_ENCRYPTION_KEY),
  googleSheetsRedirectUri: trimToUndef(e.GOOGLE_SHEETS_REDIRECT_URI),
  oauthStateSecret:
    trimToUndef(e.OAUTH_STATE_SECRET) ??
    (e.NODE_ENV === 'production' ? undefined : demoJwtSecretResolved),
  playwrightMaxContexts: e.PLAYWRIGHT_MAX_CONTEXTS,
  atsDomainHourlyCap: e.ATS_DOMAIN_HOURLY_CAP,
  demoDailyApplyCap: e.DEMO_DAILY_APPLY_CAP,
  demoAtsDomainHourlyCap: e.DEMO_ATS_DOMAIN_HOURLY_CAP,
  demoPlaywrightMaxContexts: e.DEMO_PLAYWRIGHT_MAX_CONTEXTS,
  playwrightSlotWaitMsStep: e.PLAYWRIGHT_SLOT_WAIT_MS_STEP,
  playwrightSlotWaitMaxMs: e.PLAYWRIGHT_SLOT_WAIT_MAX_MS,
  atsDomainQuotaTtlMs: e.ATS_DOMAIN_QUOTA_TTL_MS,
  dailyQuotaRedisTtlBufferMs: e.DAILY_QUOTA_REDIS_TTL_BUFFER_MS,
  manualPlaceholderJobUrl: e.MANUAL_PLACEHOLDER_JOB_URL,
  defaultProfileDailyLimit: e.DEFAULT_PROFILE_DAILY_LIMIT,
  defaultAutoApplyThreshold: e.DEFAULT_AUTO_APPLY_THRESHOLD,
  atsTargetScorePercent: e.ATS_TARGET_SCORE_PERCENT,
  atsRevisionMaxLoops: e.ATS_REVISION_MAX_LOOPS,
  playwrightLocalContextCap: e.PLAYWRIGHT_LOCAL_CONTEXT_CAP,
  playwrightPageGotoTimeoutMs: e.PLAYWRIGHT_PAGE_GOTO_TIMEOUT_MS,
  playwrightUserAgent: e.PLAYWRIGHT_USER_AGENT,
  skipAuthRateLimitWindowMs: e.SKIP_AUTH_RATE_LIMIT_WINDOW_MS,
  skipAuthRateLimitMaxProd: e.SKIP_AUTH_RATE_LIMIT_MAX_PROD,
  skipAuthRateLimitMaxDev: e.SKIP_AUTH_RATE_LIMIT_MAX_DEV,
  applicationRetryRateLimitWindowMs: e.APPLICATION_RETRY_RATE_LIMIT_WINDOW_MS,
  applicationRetryRateLimitMax: e.APPLICATION_RETRY_RATE_LIMIT_MAX,
  agentmailWebhookRateLimitWindowMs: e.AGENTMAIL_WEBHOOK_RATE_LIMIT_WINDOW_MS,
  agentmailWebhookRateLimitMax: e.AGENTMAIL_WEBHOOK_RATE_LIMIT_MAX,
  metricsApiKey: trimToUndef(e.METRICS_API_KEY),
  listingsQueryMaxDocs: e.LISTINGS_QUERY_MAX_DOCS,
  bullmqRemoveOnComplete: e.BULLMQ_REMOVE_ON_COMPLETE,
  bullmqRemoveOnFail: e.BULLMQ_REMOVE_ON_FAIL,
  defaultListingUrgencyScore: e.DEFAULT_LISTING_URGENCY_SCORE,
  defaultListingUrgencyLabel: e.DEFAULT_LISTING_URGENCY_LABEL,
  extractionConfidenceThreshold: e.EXTRACTION_CONFIDENCE_THRESHOLD,
} as const;

export type AppConfig = typeof config;
