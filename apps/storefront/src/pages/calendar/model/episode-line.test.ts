import type { CalendarEpisode } from '@/shared/api';
import { getDictionary } from '@/shared/i18n';
import { episodeLine, meaningfulTitle } from './episode-line';

const uk = getDictionary('uk');

const base: CalendarEpisode = {
  episodeId: 'e',
  showId: 's',
  showRecordId: 'r',
  showSlug: 'show',
  showTitle: 'Show',
  seasonNumber: 2,
  episodeNumber: 4,
  title: 'Heavy Is the Crown',
  airDate: '2026-11-12T19:00:00.000Z',
  runtime: 52,
  stillPath: null,
  seasonEpisodeCount: null,
  showPopularity: 1,
  isTracked: true,
  isSaved: false,
  isWatched: false,
};

describe('episodeLine', () => {
  it('shows Kyiv time, title and runtime', () => {
    expect(episodeLine(base, uk, 'uk')).toBe('21:00 · «Heavy Is the Crown» · 52 хв');
  });

  it('says “morning” for overnight releases and skips placeholder titles', () => {
    expect(
      episodeLine(
        { ...base, airDate: '2026-11-12T02:00:00.000Z', title: 'TBA', runtime: null },
        uk,
        'uk',
      ),
    ).toBe('зранку');
  });

  it('notes saved premieres', () => {
    expect(episodeLine({ ...base, isTracked: false, isSaved: true, title: null }, uk, 'uk')).toBe(
      '21:00 · 52 хв · у «Хочу подивитись»',
    );
  });
});

describe('meaningfulTitle', () => {
  it.each(['Серія 45', 'Episode 3', 'TBD', '  ', null])('drops %p', (title) => {
    expect(meaningfulTitle(title)).toBeUndefined();
  });
});
