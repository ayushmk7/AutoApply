import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { HttpError } from '../lib/httpError.js';

const execFileAsync = promisify(execFile);

const MIN_TEXT_CHARS = 80;

async function extractPdfWithPdftotext(buffer: Buffer): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), 'cv-pdf-'));
  const pdfPath = join(dir, 'cv.pdf');
  try {
    await writeFile(pdfPath, buffer);
    const { stdout } = await execFileAsync(
      'pdftotext',
      ['-layout', pdfPath, '-'],
      { maxBuffer: 20 * 1024 * 1024, timeout: 120_000 }
    );
    return Buffer.isBuffer(stdout) ? stdout.toString('utf8') : String(stdout);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractPdfWithPdfParse(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

/**
 * Phase 4.2 — PDF via `pdftotext` when available, else `pdf-parse`.
 * Scanned PDFs → little text → `CV_PARSE_FAILED` with actionable message.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const fromPoppler = await extractPdfWithPdftotext(buffer);
  let text = '';
  if (fromPoppler && fromPoppler.trim().replace(/\s+/g, '').length >= MIN_TEXT_CHARS) {
    text = fromPoppler.trim();
  } else {
    text = (await extractPdfWithPdfParse(buffer)).trim();
  }
  if (text.replace(/\s+/g, '').length < MIN_TEXT_CHARS) {
    throw new HttpError(
      400,
      'Could not extract enough text from this PDF. It may be scanned or image-only; try a text-based PDF or DOCX.',
      'CV_PARSE_FAILED'
    );
  }
  return text;
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    const text = value.trim();
    if (text.replace(/\s+/g, '').length < MIN_TEXT_CHARS) {
      throw new HttpError(
        400,
        'Could not extract enough text from this DOCX. The file may be empty or corrupt.',
        'CV_PARSE_FAILED'
      );
    }
    return text;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'Failed to parse DOCX file.', 'CV_PARSE_FAILED');
  }
}
