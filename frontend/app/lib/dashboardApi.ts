import { apiFetchJson } from './api';

export type ApplicationStatusUi =
  | 'applied'
  | 'waiting'
  | 'interview'
  | 'rejected'
  | 'offer'
  | 'manual_needed'
  | 'other';

export type ApiApplication = {
  id: string;
  listing_id: string;
  status: string;
  method?: string;
  fit_score?: number;
  ats_score?: number;
  ats_keywords_matched?: string[];
  ats_keywords_missing?: string[];
  response_type?: string;
  user_notes?: string;
  calendar_event_url?: string;
  thank_you_sent?: unknown;
  followup_sent?: unknown;
  followup_state?: string;
  followup_due_at?: unknown;
  resume_url?: string;
  cover_letter_url?: string;
  submission_screenshot?: string;
  created_at?: unknown;
  updated_at?: unknown;
};

export type ApiListing = {
  id: string;
  company?: string;
  role?: string;
  location?: string;
  source?: string;
  description?: string;
  url?: string;
  ghost_score?: number;
  urgency_score?: number;
};

export type ApiApplicationRow = {
  application: ApiApplication;
  listing: ApiListing | null;
  uiStatus: ApplicationStatusUi;
};

export type ApiFeedEvent = {
  id?: string;
  type: 'application_event';
  data: {
    application_id?: string;
    company: string;
    role: string;
    action: string;
    detail: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  };
};

function toUiStatus(status: string): ApplicationStatusUi {
  if (status === 'manual_needed') return 'manual_needed';
  if (status === 'offer' || status === 'accepted') return 'offer';
  if (status.startsWith('rejected')) return 'rejected';
  if (status === 'interview_scheduled' || status === 'thank_you_sent' || status === 'followup_sent') {
    return 'interview';
  }
  if (status === 'waiting') return 'waiting';
  if (status === 'queued' || status === 'applying' || status === 'applied' || status === 'emailed') {
    return 'applied';
  }
  return 'other';
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const s = Number((value as { seconds?: number }).seconds ?? 0);
    if (Number.isFinite(s) && s > 0) return new Date(s * 1000).toISOString();
  }
  return null;
}

export async function fetchApplicationsWithListing(accessToken: string): Promise<ApiApplicationRow[]> {
  const { applications } = await apiFetchJson<{ applications: ApiApplication[] }>(
    '/api/applications?limit=100&sort_by=updated_at',
    { accessToken }
  );
  const rows: ApiApplicationRow[] = [];
  for (const app of applications ?? []) {
    let listing: ApiListing | null = null;
    try {
      const detail = await apiFetchJson<{ listing: ApiListing | null }>(
        `/api/applications/${encodeURIComponent(app.id)}`,
        { accessToken }
      );
      listing = detail.listing ?? null;
    } catch {
      listing = null;
    }
    rows.push({
      application: app,
      listing,
      uiStatus: toUiStatus(String(app.status ?? '')),
    });
  }
  return rows;
}

export async function fetchFeed(accessToken: string): Promise<ApiFeedEvent[]> {
  const { events } = await apiFetchJson<{ events?: ApiFeedEvent[] }>('/api/feed?limit=60', { accessToken });
  return events ?? [];
}

export function describeWhen(ts: unknown): string {
  const iso = toIsoDate(ts);
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}
