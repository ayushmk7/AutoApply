/**
 * Phase 8.2 — escape LaTeX reserved characters in user- or model-generated fragments.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/\\/g, '\\textbackslash{}'],
  [/\{/g, '\\{'],
  [/\}/g, '\\}'],
  [/\$/g, '\\$'],
  [/#/g, '\\#'],
  [/%/g, '\\%'],
  [/&/g, '\\&'],
  [/_/g, '\\_'],
  [/~/g, '\\textasciitilde{}'],
  [/\^/g, '\\textasciicircum{}'],
];

export function escapeLatexFragment(input: string): string {
  let s = input;
  for (const [re, rep] of REPLACEMENTS) {
    s = s.replace(re, rep);
  }
  return s;
}
