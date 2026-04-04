import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { ListingRecruiterContact } from '../types/listing.js';

/**
 * Phase 5.5 — optional recruiter enrichment; failures are silent (omit contacts).
 */
export async function fetchApolloContactsForCompany(
  companyName: string,
  requestId: string
): Promise<ListingRecruiterContact[]> {
  const key = config.apolloApiKey;
  if (!key || !companyName.trim()) {
    return [];
  }

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': key,
      },
      body: JSON.stringify({
        q_organization_name: companyName.trim(),
        person_titles: [
          'recruiter',
          'talent acquisition',
          'hiring manager',
          'university recruiting',
        ],
        page: 1,
        per_page: 5,
      }),
    });

    if (!res.ok) {
      logger.warn(
        { requestId, status: res.status, company: companyName.slice(0, 80) },
        'apollo_search_non_ok'
      );
      return [];
    }

    const data = (await res.json()) as {
      people?: Array<{
        name?: string;
        email?: string;
        title?: string;
        organization_name?: string;
        linkedin_url?: string;
      }>;
    };

    const people = data.people ?? [];
    return people.map((p) => ({
      name: p.name,
      email: p.email,
      title: p.title,
      company: p.organization_name,
      linkedin_url: p.linkedin_url,
    }));
  } catch (err) {
    logger.warn({ err, requestId, company: companyName.slice(0, 80) }, 'apollo_search_failed');
    return [];
  }
}
