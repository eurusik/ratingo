import fc from 'fast-check';

import { ShowStatus } from '@/common/enums/show-status.enum';

import { isAnnouncedNextSeason } from './next-season-announcement';

const ongoingStatus = fc.constantFrom<string | null>(
  ShowStatus.RETURNING_SERIES,
  ShowStatus.IN_PRODUCTION,
  ShowStatus.PLANNED,
  ShowStatus.PILOT,
  null,
);
const finishedStatus = fc.constantFrom<string | null>(ShowStatus.ENDED, ShowStatus.CANCELED);
const anyStatus = fc.oneof(ongoingStatus, finishedStatus);
const lastKnown = fc.integer({ min: 1, max: 60 });

describe('isAnnouncedNextSeason', () => {
  it('accepts the dated season right after the last known one of an ongoing show', () => {
    fc.assert(
      fc.property(lastKnown, ongoingStatus, (last, showStatus) => {
        expect(
          isAnnouncedNextSeason({
            seasonNumber: last + 1,
            lastKnownSeasonNumber: last,
            showStatus,
            hasDatedEpisode: true,
          }),
        ).toBe(true);
      }),
    );
  });

  it('rejects any season that is not exactly the next one', () => {
    fc.assert(
      fc.property(
        lastKnown,
        fc.integer({ min: 0, max: 80 }),
        anyStatus,
        fc.boolean(),
        (last, seasonNumber, showStatus, hasDatedEpisode) => {
          fc.pre(seasonNumber !== last + 1);
          expect(
            isAnnouncedNextSeason({
              seasonNumber,
              lastKnownSeasonNumber: last,
              showStatus,
              hasDatedEpisode,
            }),
          ).toBe(false);
        },
      ),
    );
  });

  it('rejects an undated next season', () => {
    fc.assert(
      fc.property(lastKnown, anyStatus, (last, showStatus) => {
        expect(
          isAnnouncedNextSeason({
            seasonNumber: last + 1,
            lastKnownSeasonNumber: last,
            showStatus,
            hasDatedEpisode: false,
          }),
        ).toBe(false);
      }),
    );
  });

  it('rejects a next season of a show TMDB marks as ended or canceled', () => {
    fc.assert(
      fc.property(lastKnown, finishedStatus, (last, showStatus) => {
        expect(
          isAnnouncedNextSeason({
            seasonNumber: last + 1,
            lastKnownSeasonNumber: last,
            showStatus,
            hasDatedEpisode: true,
          }),
        ).toBe(false);
      }),
    );
  });
});
