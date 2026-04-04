import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

export interface RepoIdentity {
  owner: string;
  repo: string;
}

export function parseDefaultGithubRepos(raw: string | undefined): RepoIdentity[] {
  const line =
    raw?.trim() ||
    [
      'SimplifyJobs/Summer2025-Internships',
      'SimplifyJobs/New-Grad-Positions',
      'pittcsc/Summer2025-Internships',
      'ReaVNaiL/New-Grad-2025',
    ].join(',');

  const out: RepoIdentity[] = [];
  for (const part of line.split(',')) {
    const s = part.trim();
    const m = /^([^/]+)\/([^/]+)$/.exec(s);
    if (m) {
      out.push({ owner: m[1], repo: m[2] });
    }
  }
  return out;
}

export function repoKey(r: RepoIdentity): string {
  return `${r.owner}_${r.repo}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface GithubRepoJson {
  default_branch?: string;
}

interface GithubReadmeJson {
  content?: string;
  encoding?: string;
}

interface GithubCommitJson {
  sha?: string;
}

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AutoApply-Scraper/1.0',
  };
  if (config.githubToken) {
    h.Authorization = `Bearer ${config.githubToken}`;
  }
  return h;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function githubFetch(
  url: string,
  requestId: string,
  depth = 0
): Promise<Response> {
  if (depth > 5) {
    throw new Error('github_rate_limit_retry_exhausted');
  }
  const res = await fetch(url, { headers: githubHeaders() });
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  if (remaining === '0' && reset) {
    const waitSec = Math.max(1, Number(reset) - Math.floor(Date.now() / 1000));
    logger.warn({ requestId, waitSec }, 'github_rate_limit_backoff');
    await sleep(Math.min(waitSec * 1000, 120_000));
    return githubFetch(url, requestId, depth + 1);
  }
  return res;
}

export async function fetchRepoDefaultBranch(
  r: RepoIdentity,
  requestId: string
): Promise<string> {
  const url = `https://api.github.com/repos/${r.owner}/${r.repo}`;
  const res = await githubFetch(url, requestId);
  if (!res.ok) {
    throw new Error(`github_repo_${res.status}`);
  }
  const j = (await res.json()) as GithubRepoJson;
  return j.default_branch || 'main';
}

export async function fetchLatestCommitSha(
  r: RepoIdentity,
  branch: string,
  requestId: string
): Promise<string> {
  const url = `https://api.github.com/repos/${r.owner}/${r.repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`;
  const res = await githubFetch(url, requestId);
  if (!res.ok) {
    throw new Error(`github_commits_${res.status}`);
  }
  const j = (await res.json()) as GithubCommitJson[];
  const sha = Array.isArray(j) && j[0]?.sha ? j[0].sha : undefined;
  if (!sha) {
    throw new Error('github_commit_sha_missing');
  }
  return sha;
}

export async function fetchReadmeMarkdown(
  r: RepoIdentity,
  ref: string,
  requestId: string
): Promise<string> {
  const url = `https://api.github.com/repos/${r.owner}/${r.repo}/readme?ref=${encodeURIComponent(ref)}`;
  const res = await githubFetch(url, requestId);
  if (!res.ok) {
    throw new Error(`github_readme_${res.status}`);
  }
  const j = (await res.json()) as GithubReadmeJson;
  if (j.encoding !== 'base64' || !j.content) {
    throw new Error('github_readme_bad_payload');
  }
  return Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf8');
}
