import * as fc from 'fast-check';

import {
  FINDING_TOPICS,
  FindingKind,
  FindingTopic,
} from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import type { Finding } from '../entities/finding';

import { PrecedentId, findPrecedent } from './precedents';

const build = (overrides: Partial<Finding> = {}): Finding => ({
  file: 'src/service.ts',
  line: 3,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  checkId: null,
  message: 'broken',
  evidence: { path: 'src/service.ts', line: 3, excerpt: 'const value = compute();' },
  ...overrides,
});

describe('findPrecedent', () => {
  it('drops findings about environment variables and denial of service by topic alone', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 40 }),
        fc.string({ maxLength: 40 }),
        (message, excerpt) => {
          const base = { message, evidence: { path: 'src/service.ts', line: 1, excerpt } };
          return (
            findPrecedent(build({ ...base, topic: FindingTopic.ENV_CONFIG })) ===
              PrecedentId.ENV_TRUSTED &&
            findPrecedent(build({ ...base, topic: FindingTopic.DOS_RATE_LIMIT })) ===
              PrecedentId.NO_DOS_ADVICE
          );
        },
      ),
    );
  });

  it('never drops by message text, only by structured fields', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 80 }),
        fc.constantFrom(...FINDING_TOPICS.filter((topic) => topic === FindingTopic.LOGIC)),
        (message, topic) => findPrecedent(build({ message, topic })) === null,
      ),
    );
  });

  it('drops every finding in Markdown files', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(Severity)),
        fc.constantFrom(...Object.values(FindingCategory)),
        fc.constantFrom('README.md', 'docs/guide.md', 'apps/ai/happy/README.md'),
        (severity, category, file) =>
          findPrecedent(build({ severity, category, file })) === PrecedentId.DOCS_FILES,
      ),
    );
  });

  it('reports React XSS only when the cited line holds dangerouslySetInnerHTML', () => {
    const xss = (excerpt: string, file = 'src/view.tsx') =>
      build({ file, topic: FindingTopic.XSS, evidence: { path: file, line: 1, excerpt } });
    expect(findPrecedent(xss('<div>{user.name}</div>'))).toBe(PrecedentId.REACT_XSS_NEEDS_RAW_HTML);
    expect(findPrecedent(xss('<div dangerouslySetInnerHTML={{ __html: html }} />'))).toBeNull();
    expect(findPrecedent(xss('res.send(`<p>${name}</p>`)', 'src/render.ts'))).toBeNull();
  });

  it('does not ask for security or performance findings in test files', () => {
    expect(
      findPrecedent(build({ file: 'src/a.spec.ts', category: FindingCategory.SECURITY })),
    ).toBe(PrecedentId.TEST_FILES_SECURITY_PERFORMANCE);
    expect(
      findPrecedent(build({ file: 'src/a.spec.ts', category: FindingCategory.CORRECTNESS })),
    ).toBeNull();
  });
});
