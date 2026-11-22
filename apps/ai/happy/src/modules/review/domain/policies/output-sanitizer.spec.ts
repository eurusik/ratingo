import * as fc from 'fast-check';

import { sanitizeModelText } from './output-sanitizer';

const MENTION_OUTSIDE_CODE = /(^|[^\w`])@\w/;

const proseArb = fc
  .array(
    fc.constantFrom(
      '@bob',
      '@@bob',
      'x@@bob',
      '![i](http://a.b/c.png)',
      '[t](https://evil.example/x)',
      '<img src="http://a.b/c">',
      '<https://a.b>',
      'https://a.b/path',
      'www.example.com',
      'plain',
      ' ',
      '\n',
      '(',
      ')',
      '[',
      ']',
      '!',
    ),
    { maxLength: 12 },
  )
  .map((parts) => parts.join(''));

describe('sanitizeModelText', () => {
  it('removes mentions, images and links from prose', () => {
    fc.assert(
      fc.property(proseArb, (text) => {
        const clean = sanitizeModelText(text);
        return (
          !MENTION_OUTSIDE_CODE.test(clean) &&
          !/!\[[^\]]*\]\(/.test(clean) &&
          !/https?:\/\//i.test(clean)
        );
      }),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.oneof(proseArb, fc.string()), (text) => {
        const once = sanitizeModelText(text);
        return sanitizeModelText(once) === once;
      }),
    );
  });

  it('keeps text without anything to strip', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9 .,\n-]*$/),
        (text) => sanitizeModelText(text) === text,
      ),
    );
  });

  it('keeps decorators and URLs inside code', () => {
    const text = 'Use `@Inject(TOKEN)` here:\n```ts\n// see https://a.b\n@Injectable()\n```';
    expect(sanitizeModelText(text)).toBe(text);
  });

  it('replaces a mention and keeps the words around it', () => {
    expect(sanitizeModelText('thanks @alice for [the fix](https://a.b/c)')).toBe(
      'thanks alice for the fix',
    );
  });

  it('marks a bare link as removed', () => {
    expect(sanitizeModelText('see https://a.b/c now')).toBe('see [link removed] now');
  });
});
