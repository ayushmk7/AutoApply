import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

export interface CompileLatexResult {
  ok: boolean;
  pdf?: Buffer;
  log?: string;
}

/**
 * Phase 8.3 — `pdflatex` with timeout; runs twice for TOC/refs when needed.
 */
export async function compileLatexToPdf(
  texSource: string,
  requestId: string,
  opts: { timeoutMs?: number; extraInputs?: { name: string; path: string }[] } = {}
): Promise<CompileLatexResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const dir = await mkdtemp(join(tmpdir(), 'latex-'));
  const texPath = join(dir, 'resume.tex');
  try {
    await writeFile(texPath, texSource, 'utf8');
    if (opts.extraInputs?.length) {
      for (const f of opts.extraInputs) {
        await copyFile(f.path, join(dir, f.name));
      }
    }

    const argsBase = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-output-directory',
      dir,
      texPath,
    ];

    for (let pass = 0; pass < 2; pass++) {
      try {
        await execFileAsync('pdflatex', argsBase, {
          timeout: timeoutMs,
          maxBuffer: 20 * 1024 * 1024,
          cwd: dir,
        });
      } catch (err: unknown) {
        const log = await readFile(join(dir, 'resume.log'), 'utf8').catch(() => '');
        logger.warn({ err, requestId, pass }, 'pdflatex_failed');
        return { ok: false, log: log.slice(0, 24_000) };
      }
    }

    const pdf = await readFile(join(dir, 'resume.pdf')).catch(() => null);
    if (!pdf) {
      const log = await readFile(join(dir, 'resume.log'), 'utf8').catch(() => '');
      return { ok: false, log: log.slice(0, 24_000) };
    }
    return { ok: true, pdf };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
