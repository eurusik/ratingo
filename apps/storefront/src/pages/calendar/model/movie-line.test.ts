import { getDictionary } from '@/shared/i18n';
import { movieLine } from './movie-line';

const dict = getDictionary('uk');
const MOVIE = { releaseDateKind: 'theatrical', isSavedForLater: false } as const;

describe('movieLine', () => {
  it('promises a reminder only while one is really set for a movie that is coming out', () => {
    expect(movieLine(MOVIE, { isComingOut: true, isReminderOn: true }, dict)).toBe(
      'в кіно · нагадаємо, коли вийде',
    );
  });

  it('falls back to the saved note when saving did not set a reminder', () => {
    expect(
      movieLine(
        { ...MOVIE, isSavedForLater: true },
        { isComingOut: true, isReminderOn: false },
        dict,
      ),
    ).toBe('в кіно · у «Хочу подивитись»');
  });

  it('keeps the saved note once the movie is out', () => {
    expect(
      movieLine(
        { ...MOVIE, isSavedForLater: true },
        { isComingOut: false, isReminderOn: true },
        dict,
      ),
    ).toBe('в кіно · у «Хочу подивитись»');
  });

  it('shows just the release kind otherwise', () => {
    expect(movieLine(MOVIE, { isComingOut: true, isReminderOn: false }, dict)).toBe('в кіно');
  });
});
