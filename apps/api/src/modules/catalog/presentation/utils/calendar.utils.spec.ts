import type { CalendarEpisode } from '../../domain/repositories/show.repository.interface';

import { groupEpisodesByDate } from './calendar.utils';

describe('groupEpisodesByDate', () => {
  const createEpisode = (date: string, showId: string = 'show-1'): CalendarEpisode => ({
    showId,
    showSlug: `show-${showId}`,
    showTitle: `Show ${showId}`,
    posterPath: null,
    seasonNumber: 1,
    episodeNumber: 1,
    title: 'Episode',
    overview: null,
    airDate: new Date(date),
    runtime: 45,
    stillPath: null,
  });

  it('groups episodes by their air date', () => {
    const episodes = [
      createEpisode('2025-01-15T10:00:00Z', 'show-1'),
      createEpisode('2025-01-15T20:00:00Z', 'show-2'),
      createEpisode('2025-01-16T12:00:00Z', 'show-3'),
    ];

    const result = groupEpisodesByDate(episodes);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2025-01-15');
    expect(result[0].episodes).toHaveLength(2);
    expect(result[1].date).toBe('2025-01-16');
    expect(result[1].episodes).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    const result = groupEpisodesByDate([]);

    expect(result).toEqual([]);
  });

  it('sorts days chronologically', () => {
    const episodes = [
      createEpisode('2025-01-20T10:00:00Z'),
      createEpisode('2025-01-10T10:00:00Z'),
      createEpisode('2025-01-15T10:00:00Z'),
    ];

    const result = groupEpisodesByDate(episodes);

    expect(result.map((d) => d.date)).toEqual(['2025-01-10', '2025-01-15', '2025-01-20']);
  });

  it('handles single episode correctly', () => {
    const episodes = [createEpisode('2025-01-15T10:00:00Z')];

    const result = groupEpisodesByDate(episodes);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-01-15');
    expect(result[0].episodes).toHaveLength(1);
  });

  it('preserves episode data in grouped results', () => {
    const episode: CalendarEpisode = {
      showId: 'show-123',
      showSlug: 'breaking-bad',
      showTitle: 'Breaking Bad',
      posterPath: '/poster.jpg',
      seasonNumber: 5,
      episodeNumber: 16,
      title: 'Felina',
      overview: 'The finale',
      airDate: new Date('2025-01-15T21:00:00Z'),
      runtime: 55,
      stillPath: '/still.jpg',
    };

    const result = groupEpisodesByDate([episode]);

    expect(result[0].episodes[0]).toEqual(episode);
  });

  it('handles multiple episodes on same day from same show', () => {
    const episodes = [
      createEpisode('2025-01-15T10:00:00Z', 'show-1'),
      createEpisode('2025-01-15T11:00:00Z', 'show-1'),
    ];

    const result = groupEpisodesByDate(episodes);

    expect(result).toHaveLength(1);
    expect(result[0].episodes).toHaveLength(2);
  });
});
