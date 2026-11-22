import * as fc from 'fast-check';

import { SkipReason } from '../constants/skip-patterns.constants';
import type { ChangedFile } from '../entities/pull-request';
import { FileStatus } from '../entities/pull-request';

import { globMatches } from './glob-match';
import { parseRule, selectRules } from './rule-selector';
import { decideSkip, isIgnoredFile, reviewableFiles } from './skip-policy';
import {
  buildChangedFile,
  buildPullRequest,
} from '../../infrastructure/testing/fake-code-host.testing';

const file = (path: string, additions = 30, deletions = 0): ChangedFile =>
  buildChangedFile({ path, additions, deletions, status: FileStatus.MODIFIED });

describe('globMatches', () => {
  it.each([
    ['**/package-lock.json', 'package-lock.json', true],
    ['**/package-lock.json', 'apps/api/package-lock.json', true],
    ['docs/**', 'docs/a/b.md', true],
    ['docs/**', 'src/docs.md', false],
    ['apps/*/src/**', 'apps/api/src/x/y.ts', true],
    ['apps/*/src/**', 'apps/api/lib/x.ts', false],
    ['**/.env.*', 'apps/api/.env.local', true],
    ['src/a?.ts', 'src/ab.ts', true],
    ['src/a?.ts', 'src/a/b.ts', false],
  ])('%s vs %s', (pattern, path, expected) => {
    expect(globMatches(pattern, path)).toBe(expected);
  });

  it('treats regex characters in a pattern literally', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,6}$/),
        (name) => !globMatches('a.b+c(d)', `a${name}b+c(d)`),
      ),
    );
  });
});

describe('decideSkip', () => {
  const pr = buildPullRequest();

  it('reviews a normal pull request', () => {
    expect(decideSkip(pr, [file('src/a.ts', 30)])).toBeNull();
  });

  it.each([
    ['draft', buildPullRequest({ isDraft: true }), [file('src/a.ts')], SkipReason.DRAFT],
    [
      'fork',
      buildPullRequest({ headRepository: 'mallory/shop' }),
      [file('src/a.ts')],
      SkipReason.UNTRUSTED_FORK,
    ],
    [
      'bot',
      buildPullRequest({ author: 'dependabot[bot]' }),
      [file('src/a.ts')],
      SkipReason.BOT_AUTHOR,
    ],
    ['lockfile only', pr, [file('package-lock.json', 500)], SkipReason.NOTHING_TO_REVIEW],
    ['docs only', pr, [file('README.md', 100), file('docs/a.md', 50)], SkipReason.DOCS_ONLY],
    ['tiny', pr, [file('src/a.ts', 10, 5)], SkipReason.TRIVIAL],
  ])('skips %s', (_name, request, files, reason) => {
    expect(decideSkip(request, files)).toBe(reason);
  });

  it('compares the head repository case-insensitively', () => {
    const request = buildPullRequest({
      ref: { owner: 'Acme', repo: 'Shop', number: 1 },
      headRepository: 'acme/shop',
    });
    expect(decideSkip(request, [file('src/a.ts')])).toBeNull();
  });

  it('lets an allowlisted fork author through', () => {
    const fork = buildPullRequest({ headRepository: 'alice/shop', author: 'alice' });
    expect(
      decideSkip(fork, [file('src/a.ts')], {
        allowedAuthors: ['alice'],
        minChangedLines: 20,
        maxChangedLines: 6000,
      }),
    ).toBeNull();
  });

  it('never reviews fewer than the minimum reviewable lines', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.constantFrom('src/a.ts', 'README.md', 'yarn.lock'), fc.nat(40), fc.nat(40)),
          {
            maxLength: 6,
          },
        ),
        (entries) => {
          const files = entries.map(([path, add, del]) => file(path, add, del));
          const lines = reviewableFiles(files).reduce(
            (sum, f) => sum + f.additions + f.deletions,
            0,
          );
          return decideSkip(pr, files) !== null || lines >= 20;
        },
      ),
    );
  });

  it('flags ignored files consistently', () => {
    expect(isIgnoredFile('packages/api-contract/src/types.ts')).toBe(true);
    expect(isIgnoredFile('apps/api/drizzle_v2/meta/_journal.json')).toBe(true);
    expect(isIgnoredFile('apps/api/src/a.ts')).toBe(false);
  });
});

describe('rules', () => {
  const rules = [
    parseRule({ path: 'CLAUDE.md', content: '# Project\nglobal rules' }),
    parseRule({
      path: '.claude/rules/api-modules.md',
      content: '---\npaths:\n  - "apps/api/**"\n---\n\n# Backend\nuse tokens',
    }),
    parseRule({
      path: '.claude/rules/frontend.md',
      content: '---\npaths:\n  - "apps/web-client/**"\n  - "apps/storefront/**"\n---\n# Frontend',
    }),
  ];

  it('parses scopes and strips frontmatter', () => {
    expect(rules[1]).toMatchObject({
      name: 'api-modules',
      scopes: ['apps/api/**'],
      body: '# Backend\nuse tokens',
    });
    expect(rules[0]?.scopes).toEqual([]);
  });

  it('always includes global rules and matches scoped rules by file', () => {
    expect(selectRules(rules, ['apps/api/src/a.ts']).map((r) => r.name)).toEqual([
      'CLAUDE',
      'api-modules',
    ]);
    expect(selectRules(rules, ['apps/storefront/x.ts']).map((r) => r.name)).toEqual([
      'CLAUDE',
      'frontend',
    ]);
  });

  it('adds a rule named by a triage topic', () => {
    expect(selectRules(rules, [], ['Frontend']).map((r) => r.name)).toContain('frontend');
  });
});
