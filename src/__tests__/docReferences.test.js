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

/**
 * Level 2: a table row that documents a function must name one that exists.
 *
 * Level 1 cannot catch this — deleting a function leaves its file in place, so
 * a doc can keep describing something that is gone. That happened: a function
 * removed as dead code stayed documented for a day while every path check
 * passed.
 *
 * Scoped to the shape these docs use for a reference — a markdown table row
 * whose first cell is a backticked identifier, with a `**Path:**` line naming
 * the file above it. Prose mentions are untouched, because a doc should be
 * free to discuss an idea without being a symbol index.
 */
const JS_FILE = /\.(js|jsx)$/;
const FILE_HEADING = /^\*\*Paths?:\*\*\s*(.+)$/;
const TABLE_ROW = /^\|\s*`([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?`\s*\|/;

const collectDocumentedSymbols = markdown => {
  const found = [];
  let currentFiles = [];

  for (const line of markdown.split('\n')) {
    const heading = line.match(FILE_HEADING);
    if (heading) {
      currentFiles = [
        ...heading[1].matchAll(/`\.?\/?(src\/[A-Za-z0-9_\-./]+)`/g),
      ]
        .map(m => m[1])
        .filter(p => JS_FILE.test(p));
      continue;
    }

    // A new section heading ends the current file's scope.
    if (line.startsWith('#')) {
      currentFiles = [];
      continue;
    }

    const row = line.match(TABLE_ROW);
    if (row && currentFiles.length > 0) {
      found.push({ symbol: row[1], files: currentFiles });
    }
  }
  return found;
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

  it.each(DOCS)('%s documents only functions that exist', doc => {
    const markdown = readFileSync(join(ROOT, doc), 'utf8');
    const documented = collectDocumentedSymbols(markdown);

    const missing = documented
      .filter(({ symbol, files }) => {
        const sources = files
          .filter(f => existsSync(join(ROOT, f)))
          .map(f => readFileSync(join(ROOT, f), 'utf8'));

        // An unreadable path is Level 1's problem, not this test's.
        if (sources.length === 0) return false;

        // Defined, exported, or a method on an object literal — this codebase
        // uses all three (dbHelpers methods, named exports, class methods).
        const declared = new RegExp(
          `(?:^|[^A-Za-z0-9_])(?:async\\s+)?${symbol}\\s*[(:=]`,
          'm',
        );
        return !sources.some(src => declared.test(src));
      })
      .map(({ symbol, files }) => `${symbol} (documented in ${files[0]})`);

    expect(
      missing,
      `${doc} documents functions that do not exist in the file it names. ` +
        'Delete or rename a function and the docs must follow in the same ' +
        'commit.',
    ).toEqual([]);
  });
});
