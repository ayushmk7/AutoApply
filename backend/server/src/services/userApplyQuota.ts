import { config } from '../lib/config.js';

/** Effective max new applications per UTC day (profile + demo cap). */
export function effectiveDailyApplicationCap(
  dailyLimitFromProfile: number | undefined,
  isDemo: boolean
): number {
  const dailyLimit = dailyLimitFromProfile ?? config.defaultProfileDailyLimit;
  return isDemo ? Math.min(dailyLimit, config.demoDailyApplyCap) : dailyLimit;
}
