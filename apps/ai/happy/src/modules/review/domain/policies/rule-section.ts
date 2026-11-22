import { MAX_RULE_SECTION_CHARS } from '../constants/review-limits.constants';
import type { RuleReference } from '../entities/check';

import type { RepoRule } from './rule-selector';

const HEADING = /^(#{1,6})\s+(.*?)\s*$/;

export const parseRuleReference = (value: string): RuleReference | null => {
  const [file, ...rest] = value.split('#');
  const heading = rest.join('#').trim();
  return file === undefined || !file.endsWith('.md')
    ? null
    : { file, heading: heading.length > 0 ? heading : null };
};

const matchesFile = (rule: RepoRule, file: string): boolean =>
  rule.path === file || rule.path.endsWith(`/${file}`);

const sectionOf = (body: string, heading: string): string | null => {
  const lines = body.split('\n');
  const wanted = heading.toLowerCase();
  const start = lines.findIndex((line) => {
    const match = HEADING.exec(line);
    return match !== null && (match[2] ?? '').toLowerCase() === wanted;
  });
  if (start === -1) return null;
  const level = (HEADING.exec(lines[start] ?? '')?.[1] ?? '#').length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => {
    const match = HEADING.exec(line);
    return match !== null && (match[1] ?? '').length <= level;
  });
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
};

export const extractRuleSection = (
  rules: readonly RepoRule[],
  reference: RuleReference,
): string | null => {
  const rule = rules.find((candidate) => matchesFile(candidate, reference.file));
  if (rule === undefined) return null;
  const text = reference.heading === null ? rule.body : sectionOf(rule.body, reference.heading);
  return text === null || text.length === 0 ? null : text.slice(0, MAX_RULE_SECTION_CHARS);
};
