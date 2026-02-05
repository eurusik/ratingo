import { mapNewEpisodeRow, mapNewEpisodeRows, type NewEpisodeRow } from './new-episode.mapper';

describe('new-episode.mapper', () => {
  const baseRow: NewEpisodeRow = {
    media_item_id: 'media-1',
    slug: 'test-show',
    title: 'Test Show',
    poster_path: '/poster.jpg',
    season_number: 2,
    episode_number: 5,
    episode_title: 'Episode Title',
    air_date: new Date('2025-06-10'),
  };

  describe('mapNewEpisodeRow', () => {
    it('should map snake_case to camelCase', () => {
      const result = mapNewEpisodeRow(baseRow);

      expect(result).toEqual({
        mediaItemId: 'media-1',
        slug: 'test-show',
        title: 'Test Show',
        posterPath: '/poster.jpg',
        seasonNumber: 2,
        episodeNumber: 5,
        episodeTitle: 'Episode Title',
        airDate: new Date('2025-06-10'),
      });
    });

    it('should use fallback for null episode_title', () => {
      const row = { ...baseRow, episode_title: null };

      const result = mapNewEpisodeRow(row);

      expect(result.episodeTitle).toBe('Episode 5');
    });

    it('should handle null poster_path', () => {
      const row = { ...baseRow, poster_path: null };

      const result = mapNewEpisodeRow(row);

      expect(result.posterPath).toBeNull();
    });

    it('should preserve Date object for air_date', () => {
      const result = mapNewEpisodeRow(baseRow);

      expect(result.airDate).toBeInstanceOf(Date);
      expect(result.airDate.toISOString()).toContain('2025-06-10');
    });
  });

  describe('mapNewEpisodeRows', () => {
    it('should map multiple rows', () => {
      const rows = [
        baseRow,
        { ...baseRow, media_item_id: 'media-2', episode_number: 6, episode_title: 'Episode 6' },
      ];

      const result = mapNewEpisodeRows(rows);

      expect(result).toHaveLength(2);
      expect(result[0].mediaItemId).toBe('media-1');
      expect(result[1].mediaItemId).toBe('media-2');
      expect(result[1].episodeNumber).toBe(6);
    });

    it('should return empty array for empty input', () => {
      const result = mapNewEpisodeRows([]);

      expect(result).toEqual([]);
    });

    it('should apply fallback to all rows with null episode_title', () => {
      const rows = [
        { ...baseRow, episode_number: 1, episode_title: null },
        { ...baseRow, episode_number: 2, episode_title: null },
        { ...baseRow, episode_number: 3, episode_title: 'Actual Title' },
      ];

      const result = mapNewEpisodeRows(rows);

      expect(result[0].episodeTitle).toBe('Episode 1');
      expect(result[1].episodeTitle).toBe('Episode 2');
      expect(result[2].episodeTitle).toBe('Actual Title');
    });
  });
});
