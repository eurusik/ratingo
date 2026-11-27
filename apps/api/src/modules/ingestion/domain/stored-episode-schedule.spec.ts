import fc from 'fast-check';

import { MediaType } from '@/common/enums/media-type.enum';

import { type NormalizedMedia } from './models/normalized-media.model';
import { keepStoredEpisodeSchedule } from './stored-episode-schedule';

const optionalDate = fc.option(fc.date({ noInvalidDate: true }), { nil: null });
const show = (details: NormalizedMedia['details']): NormalizedMedia => ({
  type: MediaType.SHOW,
  title: 'Show',
  slug: 'show',
  externalIds: { tmdbId: 1 },
  popularity: 1,
  rating: 7,
  voteCount: 10,
  isAdult: false,
  genres: [],
  credits: { cast: [], crew: [] },
  details,
});

describe('keepStoredEpisodeSchedule', () => {
  it('drops every field TMDB alone would overwrite and keeps the rest', () => {
    fc.assert(
      fc.property(
        optionalDate,
        optionalDate,
        fc.option(fc.nat(), { nil: null }),
        fc.option(fc.nat(), { nil: null }),
        fc.option(fc.string(), { nil: null }),
        (lastAirDate, nextAirDate, totalEpisodes, totalSeasons, status) => {
          const media = show({
            lastAirDate,
            nextAirDate,
            totalEpisodes,
            totalSeasons,
            status,
            seasons: [{ number: 1, episodeCount: 1, episodes: [] }],
          });

          const kept = keepStoredEpisodeSchedule(media);

          expect(kept.details).toEqual({ totalSeasons, status });
          expect(kept.title).toBe(media.title);
        },
      ),
    );
  });

  it('leaves a show without details alone', () => {
    const media = show(undefined);

    expect(keepStoredEpisodeSchedule(media)).toBe(media);
  });
});
