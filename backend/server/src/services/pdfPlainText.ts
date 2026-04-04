import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Phase 8.4 — `pdftotext` for ATS keyword pass; returns empty string on failure.
 */
export async function pdfBufferToPlainText(pdf: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pdftxt-'));
  const pdfPath = join(dir, 'doc.pdf');
  try {
    await writeFile(pdfPath, pdf);
    const { stdout } = await execFileAsync(
      'pdftotext',
      ['-layout', pdfPath, '-'],
      { maxBuffer: 20 * 1024 * 1024, timeout: 120_000 }
    );
    const text = Buffer.isBuffer(stdout) ? stdout.toString('utf8') : String(stdout);
    return text.trim();
  } catch {
    return '';
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
