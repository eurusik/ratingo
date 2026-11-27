import fc from 'fast-check';

import { COMMIT } from '../../testing/dume.testing';

import { codeLink, isCommitSha } from './code-link.policy';

const citation = { path: 'apps/api/src/tmdb/tmdb.client.ts', startLine: 10, endLine: 14 };

describe('codeLink', () => {
  it('builds a GitHub link to the exact lines of the commit', () => {
    expect(codeLink('eurusik/ratingo', COMMIT, citation)).toBe(
      `https://github.com/eurusik/ratingo/blob/${COMMIT}/apps/api/src/tmdb/tmdb.client.ts#L10-L14`,
    );
  });

  it('links a single line without a range', () => {
    expect(codeLink('eurusik/ratingo', COMMIT, { ...citation, endLine: 10 })).toMatch(/#L10$/);
  });

  it.each([
    ['a branch name instead of a commit', 'eurusik/ratingo', 'main', citation],
    ['a short commit', 'eurusik/ratingo', 'abc1234', citation],
    ['a local checkout label', 'eurusik/ratingo', 'local-checkout', citation],
    ['a repository with a space', 'eurusik/rat ingo', COMMIT, citation],
    ['a repository with a query', 'eurusik/ratingo?x=1', COMMIT, citation],
    ['a parent segment in the path', 'eurusik/ratingo', COMMIT, { ...citation, path: 'a/../b.ts' }],
    ['a path with a hash', 'eurusik/ratingo', COMMIT, { ...citation, path: 'a/b#c.ts' }],
    ['a path with a quote', 'eurusik/ratingo', COMMIT, { ...citation, path: 'a/b".ts' }],
    ['an absolute path', 'eurusik/ratingo', COMMIT, { ...citation, path: '/etc/passwd' }],
    ['an empty segment', 'eurusik/ratingo', COMMIT, { ...citation, path: 'a//b.ts' }],
    ['line zero', 'eurusik/ratingo', COMMIT, { ...citation, startLine: 0 }],
    ['an end line before the start', 'eurusik/ratingo', COMMIT, { ...citation, endLine: 9 }],
    ['a fractional line', 'eurusik/ratingo', COMMIT, { ...citation, startLine: 1.5 }],
  ])('gives no link for %s', (_name, repository, commit, cited) => {
    expect(codeLink(repository, commit, cited)).toBeNull();
  });

  it('only ever produces a link on github.com that has no quote, space or angle bracket', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.integer(),
        fc.integer(),
        (repo, path, start, end) => {
          const link = codeLink(repo, COMMIT, { path, startLine: start, endLine: end });
          return (
            link === null || (link.startsWith('https://github.com/') && !/["'<>\s]/.test(link))
          );
        },
      ),
    );
  });
});

describe('isCommitSha', () => {
  it('accepts only 40 lowercase hex characters', () => {
    expect(isCommitSha(COMMIT)).toBe(true);
    expect(isCommitSha('A'.repeat(40))).toBe(false);
    expect(isCommitSha('local-checkout')).toBe(false);
  });
});
