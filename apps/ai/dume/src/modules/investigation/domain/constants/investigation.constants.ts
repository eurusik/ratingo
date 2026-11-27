export const SearchLimits = {
  MAX_PATTERN_CHARS: 200,
  MAX_PATTERN_COMBINATIONS: 90_000,
  MAX_BOUNDED_REPEAT: 200,
  MAX_GROUP_DEPTH: 3,
  MAX_REGEX_LINE_CHARS: 300,
  MAX_MATCHES_COLLECTED: 300,
  MAX_EXTENSION_CHARS: 12,
  TIME_BUDGET_MS: 10_000,
  MATCH_CALL_TIMEOUT_MS: 3_000,
} as const;

export const ReadLimits = {
  MAX_LINES_REQUESTED: 400,
  DEFAULT_LINES: 150,
} as const;

export const ListLimits = {
  MAX_ENTRIES: 300,
} as const;

export const OutputBudgets = {
  SEARCH_CHARS: 12_000,
  READ_CHARS: 12_000,
  LIST_CHARS: 8_000,
} as const;

export const CitationLimits = {
  MAX_LINES_PER_CITATION: 80,
  MAX_CLAIMS: 12,
  MAX_CITATIONS_PER_CLAIM: 4,
  MAX_ASSUMPTIONS: 10,
  MAX_UNKNOWNS: 10,
} as const;

export const UNTRUSTED_CODE_LABEL = 'repository content';
