import fc from 'fast-check';

import { TELEGRAM_MESSAGE_LIMIT } from '../constants/telegram.constants';

import { sanitizeTelegramHtml } from './telegram-html.policy';

const KEPT_TAG = /<\/?(b|i|u|s|code|pre|blockquote( expandable)?)>/g;

const hasOnlyKeptMarkup = (html: string): boolean =>
  !/[<>]/.test(html.replace(KEPT_TAG, '')) && !/&(?!amp;|lt;|gt;|quot;|#\d+;)/.test(html);

const markupArbitrary = fc.array(
  fc.oneof(
    fc.string({ maxLength: 40 }),
    fc.constantFrom(
      '<b>',
      '</b>',
      '<i>',
      '</i>',
      '<a href="https://evil.example">',
      '</a>',
      '<script>',
      '<blockquote expandable>',
      '</blockquote>',
      '<code>',
      '</code>',
      '&amp;',
      '&',
      '<',
      '>',
    ),
  ),
  { maxLength: 60 },
);

describe('sanitizeTelegramHtml', () => {
  it('keeps the markup the digest template produces', () => {
    const html =
      '<b>Звіт</b>\n<i>курсив</i> <code>x</code>\n<blockquote expandable>деталі</blockquote>';
    expect(sanitizeTelegramHtml(html)).toBe(html);
  });

  it('removes links and unknown tags but keeps their text', () => {
    expect(sanitizeTelegramHtml('<a href="https://evil.example">клік</a> <script>x</script>')).toBe(
      'клік x',
    );
  });

  it('drops attributes other than expandable on a blockquote', () => {
    expect(sanitizeTelegramHtml('<b onclick="x">a</b>')).toBe('a');
    expect(sanitizeTelegramHtml('<blockquote cite="x">a</blockquote>')).toBe('a');
  });

  it('escapes stray angle brackets and ampersands', () => {
    expect(sanitizeTelegramHtml('1 < 2 & 3 > 2')).toBe('1 &lt; 2 &amp; 3 &gt; 2');
  });

  it('closes unclosed tags and drops stray closers', () => {
    expect(sanitizeTelegramHtml('<b>a</i> <i>b')).toBe('<b>a <i>b</i></b>');
  });

  it('cuts an over-long message to plain text under the limit', () => {
    const html = `<b>${'я'.repeat(5000)}</b>`;
    const result = sanitizeTelegramHtml(html);
    expect(result.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('<');
  });

  it('never cuts an entity in half', () => {
    const result = sanitizeTelegramHtml('a'.repeat(4090) + '&amp;&amp;&amp;&amp;', 4096);
    expect(result).not.toMatch(/&[#a-zA-Z0-9]*…$/);
  });

  it('never cuts a surrogate pair in half', () => {
    const result = sanitizeTelegramHtml('😀'.repeat(3000));
    expect(result.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
    expect(result).not.toMatch(/[\uD800-\uDBFF]…$/);
  });

  it('only ever emits kept markup within the limit, for any input', () => {
    fc.assert(
      fc.property(markupArbitrary, (parts) => {
        const result = sanitizeTelegramHtml(parts.join(''));
        expect(hasOnlyKeptMarkup(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
      }),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(markupArbitrary, (parts) => {
        const once = sanitizeTelegramHtml(parts.join(''));
        expect(sanitizeTelegramHtml(once)).toBe(once);
      }),
    );
  });

  describe('links to code', () => {
    const SHA = 'a'.repeat(40);
    const link = `https://github.com/eurusik/ratingo/blob/${SHA}/apps/api/src/a.ts#L10-L14`;

    it('keeps a link to the exact lines of a commit', () => {
      const html = `<a href="${link}">apps/api/src/a.ts:10-14</a>`;

      expect(sanitizeTelegramHtml(html)).toBe(html);
    });

    it.each([
      ['another host', `https://evil.example/eurusik/ratingo/blob/${SHA}/a.ts#L1`],
      ['a branch instead of a commit', 'https://github.com/eurusik/ratingo/blob/main/a.ts#L1'],
      ['a link without lines', `https://github.com/eurusik/ratingo/blob/${SHA}/a.ts`],
      ['a query string', `https://github.com/eurusik/ratingo/blob/${SHA}/a.ts?x=1#L1`],
      ['http', `http://github.com/eurusik/ratingo/blob/${SHA}/a.ts#L1`],
    ])('still removes a link with %s but keeps its text', (_name, href) => {
      expect(sanitizeTelegramHtml(`<a href="${href}">text</a>`)).toBe('text');
    });

    it('removes any other attribute on a link', () => {
      expect(sanitizeTelegramHtml(`<a href="${link}" onclick="x()">text</a>`)).toBe('text');
    });
  });
});
