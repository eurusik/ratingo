import { getDictionary } from '@/shared/i18n';
import { movieLine } from './movie-line';

const dict = getDictionary('uk');
const MOVIE = { releaseDateKind: 'theatrical', isSavedForLater: false } as const;

describe('movieLine', () => {
  it('promises a reminder while one is really set', () => {
    expect(movieLine(MOVIE, true, dict)).toBe('в кіно · нагадаємо, коли вийде');
  });

  it('falls back to the saved note when saving did not set a reminder', () => {
    expect(movieLine({ ...MOVIE, isSavedForLater: true }, false, dict)).toBe(
      'в кіно · у «Хочу подивитись»',
    );
  });

  it('shows just the release kind otherwise', () => {
    expect(movieLine(MOVIE, false, dict)).toBe('в кіно');
  });
});
