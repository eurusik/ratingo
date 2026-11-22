import { FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory } from '../constants/severity.constants';
import { DOCS_FILE_PATTERNS } from '../constants/skip-patterns.constants';
import type { Finding } from '../entities/finding';

import { matchesAnyGlob } from './glob-match';

const REACT_FILE_PATTERNS: readonly string[] = ['**/*.tsx', '**/*.jsx'];
const TEST_FILE_PATTERNS: readonly string[] = [
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.testing.ts',
  '**/test/**',
  '**/__tests__/**',
];
const DANGEROUS_HTML_SINK = 'dangerouslySetInnerHTML';

export const PrecedentId = {
  DOCS_FILES: 'docs-files',
  ENV_TRUSTED: 'env-vars-trusted',
  NO_DOS_ADVICE: 'no-dos-advice',
  REACT_XSS_NEEDS_RAW_HTML: 'react-xss-needs-raw-html',
  TEST_FILES_SECURITY_PERFORMANCE: 'test-files-security-performance',
} as const;
export type PrecedentId = (typeof PrecedentId)[keyof typeof PrecedentId];

interface Precedent {
  id: PrecedentId;
  applies(finding: Finding): boolean;
}

const PRECEDENTS: readonly Precedent[] = [
  { id: PrecedentId.DOCS_FILES, applies: (finding) => matchesAnyGlob(DOCS_FILE_PATTERNS, finding.file) },
  { id: PrecedentId.ENV_TRUSTED, applies: (finding) => finding.topic === FindingTopic.ENV_CONFIG },
  {
    id: PrecedentId.NO_DOS_ADVICE,
    applies: (finding) => finding.topic === FindingTopic.DOS_RATE_LIMIT,
  },
  {
    id: PrecedentId.REACT_XSS_NEEDS_RAW_HTML,
    applies: (finding) =>
      finding.topic === FindingTopic.XSS &&
      matchesAnyGlob(REACT_FILE_PATTERNS, finding.file) &&
      !finding.evidence.excerpt.includes(DANGEROUS_HTML_SINK),
  },
  {
    id: PrecedentId.TEST_FILES_SECURITY_PERFORMANCE,
    applies: (finding) =>
      matchesAnyGlob(TEST_FILE_PATTERNS, finding.file) &&
      (finding.category === FindingCategory.SECURITY ||
        finding.category === FindingCategory.PERFORMANCE),
  },
];

export const findPrecedent = (finding: Finding): PrecedentId | null =>
  PRECEDENTS.find((precedent) => precedent.applies(finding))?.id ?? null;
