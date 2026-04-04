import type { ProfilePreferences, ProfileQuestionnaire } from '../types/profile.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Phase 4.1 — deep merge for questionnaire keys; arrays on questionnaire replace when provided. */
export function mergeQuestionnaire(
  base: ProfileQuestionnaire,
  patch: Partial<ProfileQuestionnaire>
): ProfileQuestionnaire {
  const out: ProfileQuestionnaire = structuredClone(base);
  for (const key of Object.keys(patch) as (keyof ProfileQuestionnaire)[]) {
    const p = patch[key];
    if (p === undefined) continue;
    if (isPlainObject(p) && isPlainObject(out[key] as unknown)) {
      const prev = out[key] as unknown as Record<string, unknown>;
      (out as unknown as Record<string, unknown>)[key] = { ...prev, ...p };
    } else {
      (out as unknown as Record<string, unknown>)[key] = p as unknown;
    }
  }
  return out;
}

export function mergePreferences(
  base: ProfilePreferences,
  patch: Partial<ProfilePreferences>
): ProfilePreferences {
  return {
    ...base,
    ...patch,
    linkedin_connections: patch.linkedin_connections ?? base.linkedin_connections,
  };
}
