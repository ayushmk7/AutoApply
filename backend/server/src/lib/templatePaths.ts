import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { ResumeTemplate } from '../types/profile.js';

/**
 * LaTeX templates live at `backend/templates/` (Phase 1.1 / PRD §5.2).
 * Resolves from `backend/server/src|dist/lib` → `backend/`.
 */
const libDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(libDir, '..', '..', '..');

const TEMPLATE_FILES: Record<ResumeTemplate, string> = {
  jakes: 'jakes.tex',
  sidebar: 'sidebar.tex',
  minimal: 'minimal.tex',
};

export function getResumeTemplateDir(): string {
  return join(backendRoot, 'templates');
}

export function getDefaultResumeTemplatePath(): string {
  return join(getResumeTemplateDir(), 'template.tex');
}

export function getResumeTemplatePathForPreference(template: ResumeTemplate | undefined): string {
  const name = template && TEMPLATE_FILES[template] ? TEMPLATE_FILES[template] : 'template.tex';
  return join(getResumeTemplateDir(), name);
}
