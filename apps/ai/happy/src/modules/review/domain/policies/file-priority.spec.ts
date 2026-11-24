import * as fc from 'fast-check';

import {
  CORE_FILE_TIERS,
  FILE_TIER_PRIORITY,
  FileTier,
} from '../constants/file-priority.constants';
import type { Check } from '../entities/check';
import { FileStatus, type ChangedFile } from '../entities/pull-request';

import {
  changedLinesOf,
  isCoreTier,
  rankFiles,
  selectFocusFiles,
  tierOf,
  type FocusLimits,
} from './file-priority';

const file = (path: string, overrides: Partial<ChangedFile> = {}): ChangedFile => ({
  path,
  status: FileStatus.MODIFIED,
  additions: 10,
  deletions: 0,
  patch: null,
  ...overrides,
});

const check = (overrides: Partial<Check> = {}): Check => ({
  id: 'sample-check',
  area: 'api',
  summary: 'sample',
  paths: ['apps/api/src/**/*.ts'],
  triggers: [],
  rule: null,
  severityCap: 'major',
  body: 'body',
  ...overrides,
});

const LIMITS: FocusLimits = { maxFiles: 40, maxInlineChangedLines: 1_500 };

const SAMPLE_PATHS = [
  'apps/api/src/modules/chat/domain/policies/command-parser.policy.ts',
  'apps/api/src/modules/chat/domain/entities/message.ts',
  'apps/api/src/modules/chat/application/services/chat.service.ts',
  'apps/api/src/modules/chat/application/workers/chat.worker.ts',
  'apps/api/src/modules/chat/presentation/controllers/chat.controller.ts',
  'apps/api/src/modules/chat/infrastructure/adapters/telegram.adapter.ts',
  'apps/api/drizzle_v2/0100_chat.sql',
  'apps/api/src/modules/chat/chat.module.ts',
  'apps/api/src/config/env.schema.ts',
  'apps/api/src/modules/chat/domain/policies/command-parser.policy.spec.ts',
  'apps/api/src/modules/chat/fixtures/messages.ts',
  'apps/api/package.json',
  'package-lock.json',
  'apps/api/README.md',
  'packages/api-contract/src/generated.ts',
  'apps/ai/veronica/src/landing/landing.page.ts',
];

const pathArbitrary = fc.constantFrom(...SAMPLE_PATHS);

const fileArbitrary = fc.record({
  path: fc
    .tuple(pathArbitrary, fc.nat({ max: 5 }))
    .map(([path, suffix]) => path.replace(/\.(\w+)$/, `${suffix}.$1`)),
  status: fc.constantFrom(FileStatus.ADDED, FileStatus.MODIFIED),
  additions: fc.nat({ max: 400 }),
  deletions: fc.nat({ max: 400 }),
  patch: fc.constant(null),
});

const filesArbitrary = fc.uniqueArray(fileArbitrary, {
  selector: (candidate) => candidate.path,
  maxLength: 80,
});

const tierIndex = (tier: FileTier): number => FILE_TIER_PRIORITY.indexOf(tier);

describe('tierOf', () => {
  it.each([
    ['apps/api/src/modules/chat/domain/policies/command-parser.policy.ts', FileTier.DOMAIN],
    ['apps/api/src/modules/chat/domain/constants/limits.constants.ts', FileTier.DOMAIN],
    ['apps/api/src/modules/chat/application/services/chat.service.ts', FileTier.APPLICATION],
    ['apps/ai/veronica/src/landing/landing.page.ts', FileTier.APPLICATION],
    [
      'apps/api/src/modules/chat/infrastructure/adapters/telegram.adapter.ts',
      FileTier.INFRASTRUCTURE,
    ],
    ['apps/api/drizzle_v2/0100_chat.sql', FileTier.INFRASTRUCTURE],
    ['apps/api/src/modules/chat/chat.module.ts', FileTier.CONFIG],
    ['apps/api/src/config/env.schema.ts', FileTier.CONFIG],
    ['apps/api/src/modules/chat/domain/policies/command-parser.policy.spec.ts', FileTier.TEST],
    ['apps/ai/happy/eval/base-cases.ts', FileTier.TEST],
    ['apps/api/package.json', FileTier.PERIPHERAL],
    ['package-lock.json', FileTier.PERIPHERAL],
    ['apps/api/README.md', FileTier.PERIPHERAL],
    ['packages/api-contract/src/generated.ts', FileTier.PERIPHERAL],
  ])('puts %s in %s', (path, tier) => {
    expect(tierOf(file(path), [])).toBe(tier);
  });

  it('puts a file matched by a selected check first, wherever it lives', () => {
    const infrastructure = file('apps/api/src/modules/chat/infrastructure/chat.repository.ts');
    expect(tierOf(infrastructure, [check()])).toBe(FileTier.CHECK_MATCH);
  });

  it('requires a trigger hit in the added lines when the check has triggers', () => {
    const patch = '@@ -1,1 +1,2 @@\n context\n+const x = await repo.count(1)';
    const target = file('apps/api/src/modules/chat/infrastructure/chat.repository.ts', { patch });
    const withTrigger = check({ triggers: ['\\bcount\\('] });
    const otherTrigger = check({ triggers: ['\\bnever\\b'] });
    expect(tierOf(target, [withTrigger])).toBe(FileTier.CHECK_MATCH);
    expect(tierOf(target, [otherTrigger])).toBe(FileTier.INFRASTRUCTURE);
  });

  it('never lifts tests or peripheral files into the check tier', () => {
    const spec = file('apps/api/src/modules/chat/application/chat.service.spec.ts');
    const manifest = file('apps/api/src/modules/chat/package.json');
    expect(tierOf(spec, [check({ paths: ['apps/api/**'] })])).toBe(FileTier.TEST);
    expect(tierOf(manifest, [check({ paths: ['apps/api/**'] })])).toBe(FileTier.PERIPHERAL);
  });
});

describe('rankFiles', () => {
  it('orders by tier, then new files, then changed lines, then path', () => {
    const ranked = rankFiles(
      [
        file('apps/api/package.json', { additions: 900 }),
        file('apps/api/src/m/domain/policies/b.policy.ts', { additions: 5 }),
        file('apps/api/src/m/domain/policies/a.policy.ts', { additions: 5 }),
        file('apps/api/src/m/domain/policies/big.policy.ts', { additions: 300 }),
        file('apps/api/src/m/domain/policies/new.policy.ts', {
          additions: 2,
          status: FileStatus.ADDED,
        }),
        file('apps/api/src/m/m.module.ts', { additions: 40 }),
        file('apps/api/src/m/m.service.spec.ts', { additions: 200 }),
        file('apps/api/src/m/infrastructure/x.repository.ts', { additions: 50 }),
        file('apps/api/src/m/application/y.service.ts', { additions: 20 }),
      ],
      [],
    );
    expect(ranked.map(({ file: { path } }) => path)).toEqual([
      'apps/api/src/m/domain/policies/new.policy.ts',
      'apps/api/src/m/domain/policies/big.policy.ts',
      'apps/api/src/m/domain/policies/a.policy.ts',
      'apps/api/src/m/domain/policies/b.policy.ts',
      'apps/api/src/m/application/y.service.ts',
      'apps/api/src/m/infrastructure/x.repository.ts',
      'apps/api/src/m/m.module.ts',
      'apps/api/src/m/m.service.spec.ts',
      'apps/api/package.json',
    ]);
  });

  it('is deterministic and independent of input order', () => {
    fc.assert(
      fc.property(filesArbitrary, fc.integer(), (files, seed) => {
        const shuffled = [...files].sort(
          (left, right) =>
            ((left.path.length * 31 + seed) % 7) - ((right.path.length * 31 + seed) % 7),
        );
        const paths = (input: readonly ChangedFile[]): string[] =>
          rankFiles(input, [check()]).map(({ file: { path } }) => path);
        expect(paths(shuffled)).toEqual(paths(files));
      }),
    );
  });

  it('keeps every file exactly once and never decreases the tier', () => {
    fc.assert(
      fc.property(filesArbitrary, (files) => {
        const ranked = rankFiles(files, [check()]);
        expect(ranked.map(({ file: { path } }) => path).sort()).toEqual(
          files.map(({ path }) => path).sort(),
        );
        for (let index = 1; index < ranked.length; index += 1) {
          const previous = ranked[index - 1];
          const current = ranked[index];
          expect(tierIndex(previous?.tier ?? FileTier.CHECK_MATCH)).toBeLessThanOrEqual(
            tierIndex(current?.tier ?? FileTier.CHECK_MATCH),
          );
        }
      }),
    );
  });
});

describe('selectFocusFiles', () => {
  it('respects the file cap and returns unique paths', () => {
    fc.assert(
      fc.property(
        filesArbitrary,
        fc.array(pathArbitrary, { maxLength: 20 }),
        fc.integer({ min: 1, max: 30 }),
        (files, suggested, maxFiles) => {
          const ranked = rankFiles(files, [check()]);
          const selected = selectFocusFiles(ranked, suggested, { ...LIMITS, maxFiles });
          expect(selected.length).toBeLessThanOrEqual(maxFiles);
          expect(new Set(selected).size).toBe(selected.length);
        },
      ),
    );
  });

  it('never drops a core file for a lower-tier file, whatever triage suggests', () => {
    fc.assert(
      fc.property(
        filesArbitrary,
        fc.array(pathArbitrary, { maxLength: 30 }),
        fc.integer({ min: 1, max: 40 }),
        (files, suggested, maxFiles) => {
          const ranked = rankFiles(files, [check()]);
          const selected = new Set(selectFocusFiles(ranked, suggested, { ...LIMITS, maxFiles }));
          const core = ranked.filter(({ tier }) => isCoreTier(tier));
          const expectedCore = core.slice(0, maxFiles);
          for (const {
            file: { path },
          } of expectedCore) {
            expect(selected.has(path)).toBe(true);
          }
          const hasUnselectedCore = core.some(({ file: { path } }) => !selected.has(path));
          if (hasUnselectedCore) {
            const selectedTiers = ranked.filter(({ file: { path } }) => selected.has(path));
            expect(selectedTiers.every(({ tier }) => CORE_FILE_TIERS.includes(tier))).toBe(true);
          }
        },
      ),
    );
  });

  it('never selects a file of a worse tier while a better one is left out for the file cap', () => {
    fc.assert(
      fc.property(
        filesArbitrary,
        fc.array(pathArbitrary, { maxLength: 30 }),
        fc.integer({ min: 1, max: 40 }),
        (files, suggested, maxFiles) => {
          const ranked = rankFiles(files, [check()]);
          const selected = new Set(
            selectFocusFiles(ranked, suggested, {
              maxFiles,
              maxInlineChangedLines: Number.MAX_SAFE_INTEGER,
            }),
          );
          const worstSelected = Math.max(
            -1,
            ...ranked
              .filter(({ file: { path } }) => selected.has(path))
              .map(({ tier }) => tierIndex(tier)),
          );
          const bestLeftOut = Math.min(
            Number.POSITIVE_INFINITY,
            ...ranked
              .filter(({ file: { path } }) => !selected.has(path))
              .map(({ tier }) => tierIndex(tier)),
          );
          expect(bestLeftOut).toBeGreaterThanOrEqual(worstSelected);
        },
      ),
    );
  });

  it('lets triage reorder inside a tier only', () => {
    const ranked = rankFiles(
      [
        file('apps/api/src/m/domain/policies/a.policy.ts', { additions: 100 }),
        file('apps/api/src/m/domain/policies/b.policy.ts', { additions: 10 }),
        file('apps/api/src/m/m.service.spec.ts', { additions: 500 }),
      ],
      [],
    );
    const selected = selectFocusFiles(
      ranked,
      ['apps/api/src/m/m.service.spec.ts', 'apps/api/src/m/domain/policies/b.policy.ts'],
      LIMITS,
    );
    expect(selected).toEqual([
      'apps/api/src/m/domain/policies/b.policy.ts',
      'apps/api/src/m/domain/policies/a.policy.ts',
      'apps/api/src/m/m.service.spec.ts',
    ]);
  });

  it('skips non-core files that no longer fit the inline line budget', () => {
    const ranked = rankFiles(
      [
        file('apps/api/src/m/domain/policies/a.policy.ts', { additions: 1_000 }),
        file('apps/api/src/m/application/s.service.ts', { additions: 400 }),
        file('apps/api/src/m/application/t.service.ts', { additions: 300 }),
        file('apps/api/src/m/m.module.ts', { additions: 5 }),
      ],
      [],
    );
    expect(selectFocusFiles(ranked, [], LIMITS)).toEqual([
      'apps/api/src/m/domain/policies/a.policy.ts',
      'apps/api/src/m/application/s.service.ts',
      'apps/api/src/m/m.module.ts',
    ]);
  });

  it('always keeps core files even when they pass the line budget', () => {
    const ranked = rankFiles(
      [
        file('apps/api/src/m/domain/policies/a.policy.ts', { additions: 2_000 }),
        file('apps/api/src/m/domain/policies/b.policy.ts', { additions: 2_000 }),
        file('apps/api/src/m/m.module.ts', { additions: 5 }),
      ],
      [],
    );
    expect(selectFocusFiles(ranked, [], LIMITS)).toEqual([
      'apps/api/src/m/domain/policies/a.policy.ts',
      'apps/api/src/m/domain/policies/b.policy.ts',
    ]);
  });

  it('takes a single oversized non-core file rather than nothing', () => {
    const ranked = rankFiles(
      [file('apps/api/src/m/application/s.service.ts', { additions: 5_000 })],
      [],
    );
    expect(selectFocusFiles(ranked, [], LIMITS)).toEqual([
      'apps/api/src/m/application/s.service.ts',
    ]);
    expect(changedLinesOf(ranked[0]?.file ?? file('x'))).toBe(5_000);
  });
});
