import * as fc from 'fast-check';

import { parseReviewCommand } from './review-command';

const HANDLE = 'happy-on-duty';

const isReviewCommand = (body: string, handle: string): boolean =>
  parseReviewCommand(body, handle) !== null;
const RETIRED_HANDLE = 'happy';
const VERBS = ['scan', 'review'] as const;
const TRIGGERS = [`@${HANDLE}`, '/happy'] as const;

const caseVariants = (text: string): fc.Arbitrary<string> =>
  fc
    .array(fc.boolean(), { minLength: text.length, maxLength: text.length })
    .map((flags) =>
      [...text].map((char, index) => (flags[index] ? char.toUpperCase() : char)).join(''),
    );

describe('isReviewCommand', () => {
  it('accepts both verbs after the mention or the slash alias in any letter case', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TRIGGERS).chain(caseVariants),
        fc.constantFrom(...VERBS).chain(caseVariants),
        fc.constantFrom(' ', '  ', '\t'),
        (trigger, verb, gap) => isReviewCommand(`${trigger}${gap}${verb}`, HANDLE),
      ),
    );
  });

  it('allows leading blank lines and text after the command', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TRIGGERS),
        fc.constantFrom(...VERBS),
        fc.constantFrom('', ' ', '\n\n', '  \n'),
        fc.constantFrom(' please', '\nthanks', ', нова версія', ' \n\nlogs below'),
        (trigger, verb, lead, tail) => isReviewCommand(`${lead}${trigger} ${verb}${tail}`, HANDLE),
      ),
    );
  });

  it('does not recognise the retired short mention', () => {
    for (const verb of VERBS) {
      expect(isReviewCommand(`@${RETIRED_HANDLE} ${verb}`, HANDLE)).toBe(false);
    }
  });

  it('rejects a longer handle, a longer verb and a missing verb', () => {
    expect(isReviewCommand(`@${HANDLE}-bot scan`, HANDLE)).toBe(false);
    expect(isReviewCommand(`@${HANDLE}scan`, HANDLE)).toBe(false);
    expect(isReviewCommand(`@${HANDLE}\nscan`, HANDLE)).toBe(false);
    expect(isReviewCommand(`@${HANDLE} scanner`, HANDLE)).toBe(false);
    expect(isReviewCommand(`@${HANDLE} review-all`, HANDLE)).toBe(false);
    expect(isReviewCommand(`@${HANDLE}`, HANDLE)).toBe(false);
    expect(isReviewCommand('/happyscan', HANDLE)).toBe(false);
    expect(isReviewCommand('/happy scan-all', HANDLE)).toBe(false);
  });

  it('ignores a command that is not the first text', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TRIGGERS),
        fc.constantFrom(...VERBS),
        fc.stringMatching(/^[a-z]{1,12}$/),
        (trigger, verb, lead) => !isReviewCommand(`${lead}\n${trigger} ${verb}`, HANDLE),
      ),
    );
  });

  it.each([
    ['a fenced code block', '```\n@happy-on-duty scan\n```'],
    ['a tilde fence', '~~~\n/happy scan\n~~~'],
    ['an indented code block', '    @happy-on-duty scan'],
    ['a tab-indented code block', '\t@happy-on-duty scan'],
    ['inline code', '`@happy-on-duty scan`'],
    ['a quote', '> @happy-on-duty scan'],
    ['a nested quote', '>> /happy review'],
    ['a quoted reply', '> @happy-on-duty scan\n\nnot now'],
  ])('does not trigger inside %s', (_name, body) => {
    expect(isReviewCommand(body, HANDLE)).toBe(false);
  });

  it('follows the configured handle', () => {
    expect(isReviewCommand('@night-watch scan', 'night-watch')).toBe(true);
    expect(isReviewCommand(`@${HANDLE} scan`, 'night-watch')).toBe(false);
    expect(isReviewCommand('@a.b scan', 'a.b')).toBe(true);
    expect(isReviewCommand('@axb scan', 'a.b')).toBe(false);
  });

  it('reads the full modifier and defaults to auto', () => {
    expect(parseReviewCommand(`@${HANDLE} review`, HANDLE)).toEqual({ mode: 'auto' });
    expect(parseReviewCommand('/happy review full', HANDLE)).toEqual({ mode: 'full' });
    expect(parseReviewCommand('/HAPPY Scan FULL please', HANDLE)).toEqual({ mode: 'full' });
    expect(parseReviewCommand('/happy review fullness', HANDLE)).toEqual({ mode: 'auto' });
    expect(parseReviewCommand('/happy review full-ish', HANDLE)).toEqual({ mode: 'auto' });
  });
});
