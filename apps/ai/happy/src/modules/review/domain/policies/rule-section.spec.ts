import { extractRuleSection, parseRuleReference } from './rule-section';
import type { RepoRule } from './rule-selector';

const rule = (path: string, body: string): RepoRule => ({
  name: 'n',
  path,
  scopes: [],
  body,
});

const BODY = [
  '# Title',
  '',
  '## Upserts',
  'Keep stored values.',
  '### Detail',
  'More.',
  '## Races',
  'Catch 23505.',
].join('\n');

describe('rule references', () => {
  it('parses file and heading and rejects anything that is not a markdown file', () => {
    expect(parseRuleReference('api-modules.md#Upserts')).toEqual({
      file: 'api-modules.md',
      heading: 'Upserts',
    });
    expect(parseRuleReference('migrations.md')).toEqual({ file: 'migrations.md', heading: null });
    expect(parseRuleReference('notes.txt#x')).toBeNull();
  });

  it('extracts a section up to the next heading of the same or higher level', () => {
    const rules = [rule('.claude/rules/api-modules.md', BODY)];
    expect(extractRuleSection(rules, { file: 'api-modules.md', heading: 'Upserts' })).toBe(
      'Keep stored values.\n### Detail\nMore.',
    );
    expect(extractRuleSection(rules, { file: 'api-modules.md', heading: 'races' })).toBe(
      'Catch 23505.',
    );
  });

  it('returns null when the rule file or the heading is missing', () => {
    const rules = [rule('.claude/rules/api-modules.md', BODY)];
    expect(extractRuleSection(rules, { file: 'other.md', heading: 'Upserts' })).toBeNull();
    expect(extractRuleSection(rules, { file: 'api-modules.md', heading: 'Nope' })).toBeNull();
  });

  it('returns the whole file for a reference without a heading', () => {
    expect(
      extractRuleSection([rule('migrations.md', 'All of it')], {
        file: 'migrations.md',
        heading: null,
      }),
    ).toBe('All of it');
  });
});
