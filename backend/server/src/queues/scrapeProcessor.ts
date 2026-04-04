import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { globalStatsRef, scrapeRepoStateRef } from '../lib/firestorePaths.js';
import { logger } from '../lib/logger.js';
import { getFirestore } from '../lib/firebase.js';
import { config } from '../lib/config.js';
import type { ScrapeJobData } from './jobTypes.js';
import { fetchApolloContactsForCompany } from '../services/apolloEnrich.js';
import {
  claudeGhostAndUrgency,
  claudeParseListingsFromMarkdown,
  mapRepoToListingSource,
} from '../services/claude.js';
import {
  fetchLatestCommitSha,
  fetchReadmeMarkdown,
  fetchRepoDefaultBranch,
  parseDefaultGithubRepos,
  repoKey,
  type RepoIdentity,
} from '../services/githubRepoReadme.js';
import { checkJobLinkHealth } from '../services/linkHealth.js';
import { upsertListingFromParsedRow } from '../services/listingPersistence.js';
import { refreshListingStatsAggregate } from '../services/listingStats.js';
import { enqueueMatchForNewListings } from './producers.js';

async function loadRepoState(db: Firestore, r: RepoIdentity): Promise<string | null> {
  const snap = await scrapeRepoStateRef(db, repoKey(r)).get();
  const d = snap.data() as { last_commit_sha?: string } | undefined;
  return d?.last_commit_sha ?? null;
}

async function saveRepoState(db: Firestore, r: RepoIdentity, sha: string): Promise<void> {
  await scrapeRepoStateRef(db, repoKey(r)).set(
    {
      owner: r.owner,
      repo: r.repo,
      last_commit_sha: sha,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Phase 5.3 — fetch → parse → diff → store; Phase 5.4 ghost + link health; Phase 5.5 Apollo.
 */
export async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const requestId = job.data?.requestId ?? job.id ?? 'scrape';
  const triggeredBy = job.data?.triggeredBy;
  if (triggeredBy !== 'cron' && triggeredBy !== 'manual') {
    throw new UnrecoverableError('invalid_scrape_payload');
  }

  if (!config.anthropicApiKey) {
    throw new Error('scrape_requires_ANTHROPIC_API_KEY');
  }

  const db = getFirestore();
  const repos = parseDefaultGithubRepos(config.githubScrapeReposRaw);
  if (repos.length === 0) {
    logger.warn({ requestId }, 'scrape_no_repos_configured');
    return;
  }

  let newListings = 0;
  const newListingIds: string[] = [];
  let reposChecked = 0;
  let lastError: string | null = null;

  for (const r of repos) {
    reposChecked += 1;
    try {
      const branch = await fetchRepoDefaultBranch(r, requestId);
      const sha = await fetchLatestCommitSha(r, branch, requestId);
      const prev = await loadRepoState(db, r);
      if (prev === sha) {
        logger.info({ requestId, repo: `${r.owner}/${r.repo}` }, 'scrape_repo_unchanged');
        continue;
      }

      const markdown = await fetchReadmeMarkdown(r, sha, requestId);
      const source = mapRepoToListingSource(r.owner, r.repo);
      const rows = await claudeParseListingsFromMarkdown(
        markdown,
        `${r.owner}/${r.repo}`,
        requestId
      );

      for (const row of rows) {
        const summary = `${row.company} | ${row.role} | ${row.url}\n${row.description}`.slice(
          0,
          16_000
        );
        let ghost = await claudeGhostAndUrgency(summary, requestId);
        const url = row.url?.trim() ? row.url : '';
        let linkStatus: number | null = null;
        if (url) {
          linkStatus = await checkJobLinkHealth(url);
          if (linkStatus === 404 || linkStatus === 410) {
            ghost = {
              ...ghost,
              ghost_score: Math.min(100, ghost.ghost_score + 25),
              ghost_reasons: [...ghost.ghost_reasons, `Link check returned HTTP ${linkStatus}`],
            };
          }
        }

        let apollo: Awaited<ReturnType<typeof fetchApolloContactsForCompany>> = [];
        if (row.company?.trim()) {
          apollo = await fetchApolloContactsForCompany(row.company, requestId);
        }

        const { created, listingId: upsertListingId } = await upsertListingFromParsedRow(
          db,
          row,
          source,
          {
            ghost_score: ghost.ghost_score,
            ghost_reasons: ghost.ghost_reasons,
            urgency_score: ghost.urgency_score,
            urgency_label: ghost.urgency_label,
            apollo_contacts: apollo.length ? apollo : undefined,
            link_health_status: linkStatus,
          },
          requestId
        );

        if (created) {
          newListings += 1;
          if (upsertListingId) newListingIds.push(upsertListingId);
        }
      }

      await saveRepoState(db, r, sha);
      logger.info(
        { requestId, repo: `${r.owner}/${r.repo}`, rows: rows.length },
        'scrape_repo_ok'
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.error(
        { err, requestId, repo: `${r.owner}/${r.repo}` },
        'scrape_repo_failed'
      );
    }
  }

  await globalStatsRef(db).set(
    {
      last_scrape_at: FieldValue.serverTimestamp(),
      last_scrape_status: lastError ? 'degraded' : 'ok',
      last_scrape_error: lastError,
      last_scrape_new_listings: newListings,
      last_scrape_repos_checked: reposChecked,
      last_scrape_trigger: triggeredBy,
    },
    { merge: true }
  );

  await refreshListingStatsAggregate(db, requestId);
  await enqueueMatchForNewListings(newListingIds, 'scrape', requestId);
}
