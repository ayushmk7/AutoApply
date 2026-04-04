import { chromium, type Browser, type BrowserContext } from 'playwright';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { acquirePlaywrightSlotGlobal } from '../lib/playwrightRedisSemaphore.js';
import { getQuotaRedis } from '../lib/redisQuota.js';

let browser: Browser | null = null;
let activeLocal = 0;
const waiters: Array<() => void> = [];

async function acquireLocal(maxLocal: number): Promise<void> {
  if (activeLocal < maxLocal) {
    activeLocal++;
    return;
  }
  await new Promise<void>((resolve) => {
    waiters.push(resolve);
  });
  activeLocal++;
}

function releaseLocal(): void {
  activeLocal--;
  const next = waiters.shift();
  if (next) next();
}

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
    } catch (err) {
      logger.error({ err }, 'playwright_launch_failed');
      throw err;
    }
    browser.on('disconnected', () => {
      browser = null;
    });
  }
  return browser;
}

async function runInContext<T>(fn: (context: BrowserContext) => Promise<T>): Promise<T> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: config.playwrightUserAgent,
    locale: 'en-US',
    viewport: { width: 1280, height: 720 },
  });
  try {
    return await fn(context);
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Phase 9.1 / 16 — singleton browser; Redis cluster cap when `REDIS_URL` is set, else in-process cap.
 */
export async function withApplicationContext<T>(
  fn: (context: BrowserContext) => Promise<T>,
  opts: { isDemo?: boolean; requestId?: string } = {}
): Promise<T> {
  const globalMax = opts.isDemo ? config.demoPlaywrightMaxContexts : config.playwrightMaxContexts;
  const hasRedis = Boolean(getQuotaRedis());

  if (hasRedis) {
    const slot = await acquirePlaywrightSlotGlobal(globalMax, opts.requestId ?? 'playwright');
    if (!slot) {
      throw new Error('PLAYWRIGHT_SLOT_TIMEOUT');
    }
    try {
      return await runInContext(fn);
    } finally {
      await slot.release();
    }
  }

  const localCap = Math.min(globalMax, config.playwrightLocalContextCap);
  await acquireLocal(localCap);
  try {
    return await runInContext(fn);
  } finally {
    releaseLocal();
  }
}

export async function disposePlaywrightManager(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
