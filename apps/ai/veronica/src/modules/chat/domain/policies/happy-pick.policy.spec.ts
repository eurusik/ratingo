import fc from 'fast-check';

import { formatAgo, renderPullRequestChoice } from './happy-pick.policy';

const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);
const MINUTE = 60_000;

describe('formatAgo', () => {
  it.each([
    [0, 'щойно'],
    [30_000, 'щойно'],
    [5 * MINUTE, '5 хв тому'],
    [59 * MINUTE, '59 хв тому'],
    [60 * MINUTE, '1 год тому'],
    [23 * 60 * MINUTE, '23 год тому'],
    [48 * 60 * MINUTE, '2 дн тому'],
  ])('shows %i ms as «%s»', (delta, text) => {
    expect(formatAgo(NOW, NOW - delta)).toBe(text);
  });

  it('never goes negative or fails, even for a time in the future or garbage', () => {
    fc.assert(
      fc.property(fc.integer(), fc.oneof(fc.integer(), fc.constant(Number.NaN)), (now, then) =>
        /^(щойно|\d+ (хв|год|дн) тому)$/.test(formatAgo(now, then)),
      ),
    );
  });
});

describe('renderPullRequestChoice', () => {
  const pull = (number: number, title: string) => ({
    number,
    title,
    author: 'alice',
    updatedAtMs: NOW - 5 * MINUTE,
  });

  it('shows at most five, with number, title, author and age, and notes the rest', () => {
    const pulls = Array.from({ length: 7 }, (_, i) => pull(i + 1, `T${i + 1}`));
    const html = renderPullRequestChoice(pulls, NOW);
    expect(html).toContain('Який глянути? Напиши номер');
    expect(html).toContain('• №1 «T1» (alice, 5 хв тому)');
    expect(html).not.toContain('№6');
    expect(html).toContain('п’ять найновіших');
  });

  it('escapes markup and strips links from titles, whatever they are', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        const html = renderPullRequestChoice([pull(1, title), pull(2, 'x')], NOW);
        const body = html.split('\n').slice(1).join('\n');
        return !/[<>]/.test(body) && !/https?:\/\//.test(body);
      }),
    );
  });
});
