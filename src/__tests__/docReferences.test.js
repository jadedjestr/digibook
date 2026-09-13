import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import { describe, it, expect } from 'vitest';

/**
 * Documentation drifts silently. This makes one specific, high-frequency
 * class of drift impossible: a document naming a file that does not exist.
 *
 * It is a ratchet, not a guarantee — it cannot tell you a paragraph is wrong,
 * only that a path is dead. That is deliberately narrow, and it would have
 * caught every stale reference found when this check was written (two deleted
 * modules and six deleted components, all still documented).
 *
 * Renames and moves are covered for free.
 */

const ROOT = resolve(__dirname, '../..');

const DOCS = readdirSync(ROOT).filter(f => f.endsWith('.md'));

// `src/...` or `./src/...` inside backticks — the way these docs cite code.
const PATH_IN_BACKTICKS = /`\.?\/?(src\/[A-Za-z0-9_\-./]+)`/g;

const collectReferences = markdown => {
  const found = new Set();
  for (const [, path] of markdown.matchAll(PATH_IN_BACKTICKS)) {
    // Strip a trailing period that belongs to the prose, not the filename.
    found.add(path.replace(/\.$/, ''));
  }
  return [...found];
};

describe('documentation references real files', () => {
  it('finds documents to check', () => {
    expect(DOCS.length).toBeGreaterThan(0);
  });

  it.each(DOCS)('%s names only files that exist', doc => {
    const markdown = readFileSync(join(ROOT, doc), 'utf8');
    const referenced = collectReferences(markdown);

    const missing = referenced.filter(p => {
      if (existsSync(join(ROOT, p))) return false;

      // A directory reference, or a path cited without its extension.
      return ![
        '',
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '/index.js',
        '/index.jsx',
      ].some(ext => existsSync(join(ROOT, p + ext)));
    });

    expect(
      missing,
      `${doc} references files that no longer exist. Update the document in ` +
        'the same commit that moved or deleted them.',
    ).toEqual([]);
  });
});
