import fc from 'fast-check';

import { ShowStatus } from '@/common/enums/show-status.enum';

import { seasonEpisodeCount } from './season-episode-count';

const episodeCount = fc.nat({ max: 500 });
const announcedCount = fc.option(episodeCount, { nil: undefined });
const airingStatus = fc.constantFrom<string | null>(
  ShowStatus.RETURNING_SERIES,
  ShowStatus.IN_PRODUCTION,
  null,
);
const finishedStatus = fc.constantFrom<string | null>(ShowStatus.ENDED, ShowStatus.CANCELED);
const anyStatus = fc.oneof(airingStatus, finishedStatus);

const airingLatest = { showStatus: ShowStatus.RETURNING_SERIES, isLatestSeason: true };

describe('seasonEpisodeCount', () => {
  it('keeps the announced size while only part of the airing season is listed', () => {
    expect(seasonEpisodeCount({ listedEpisodes: 3, announcedEpisodes: 10, ...airingLatest })).toBe(
      10,
    );
  });

  it('keeps the listed size when more episodes are listed than announced', () => {
    expect(seasonEpisodeCount({ listedEpisodes: 12, announcedEpisodes: 6, ...airingLatest })).toBe(
      12,
    );
  });

  it('falls back to the listed size when the size was not announced', () => {
    expect(
      seasonEpisodeCount({ listedEpisodes: 4, announcedEpisodes: undefined, ...airingLatest }),
    ).toBe(4);
  });

  it('trusts the full list of a finished show over an overcounted announcement', () => {
    expect(
      seasonEpisodeCount({
        listedEpisodes: 4,
        announcedEpisodes: 5,
        showStatus: ShowStatus.ENDED,
        isLatestSeason: true,
      }),
    ).toBe(4);
  });

  it('trusts the full list of an earlier season of an airing show', () => {
    expect(
      seasonEpisodeCount({
        listedEpisodes: 8,
        announcedEpisodes: 10,
        showStatus: ShowStatus.RETURNING_SERIES,
        isLatestSeason: false,
      }),
    ).toBe(8);
  });

  it('is never smaller than either source for the latest season of an airing show', () => {
    fc.assert(
      fc.property(
        episodeCount,
        announcedCount,
        airingStatus,
        (listedEpisodes, announcedEpisodes, showStatus) => {
          const count = seasonEpisodeCount({
            listedEpisodes,
            announcedEpisodes,
            showStatus,
            isLatestSeason: true,
          });
          expect(count).toBeGreaterThanOrEqual(listedEpisodes);
          expect(count).toBeGreaterThanOrEqual(announcedEpisodes ?? 0);
          expect([listedEpisodes, announcedEpisodes]).toContain(count);
        },
      ),
    );
  });

  it('is the listed size for a finished show or an earlier season', () => {
    fc.assert(
      fc.property(
        episodeCount,
        announcedCount,
        fc.oneof(
          fc.record({ showStatus: finishedStatus, isLatestSeason: fc.boolean() }),
          fc.record({ showStatus: anyStatus, isLatestSeason: fc.constant(false) }),
        ),
        (listedEpisodes, announcedEpisodes, season) => {
          expect(seasonEpisodeCount({ listedEpisodes, announcedEpisodes, ...season })).toBe(
            listedEpisodes,
          );
        },
      ),
    );
  });
});
