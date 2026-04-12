import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeLatexFragment } from './latexEscape.js';

describe('escapeLatexFragment', () => {
  it('escapes reserved characters', () => {
    assert.equal(escapeLatexFragment('a$b'), 'a\\$b');
    assert.equal(escapeLatexFragment('{x}'), '\\{x\\}');
    assert.equal(escapeLatexFragment('A&B_#%'), 'A\\&B\\_\\#\\%');
    assert.equal(escapeLatexFragment('10^2 ~ user'), '10\\textasciicircum{}2 \\textasciitilde{} user');
  });
});
