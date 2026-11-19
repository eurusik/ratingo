import { SUBSCRIPTION_TRIGGER } from '@/modules/user-actions/domain/entities/user-subscription.entity';

import { type ClaimedMovieReleaseRow, toMovieReleaseNotice } from './claimed-movie-release.mapper';

const row = (overrides: Partial<ClaimedMovieReleaseRow>): ClaimedMovieReleaseRow => ({
  id: 'sub-1',
  userId: 'user-1',
  mediaItemId: 'movie-1',
  theatricalReleaseDate: null,
  digitalReleaseDate: null,
  releaseDate: null,
  releases: [],
  ...overrides,
});

describe('toMovieReleaseNotice', () => {
  it('labels a cinema release with the country of its date', () => {
    const notice = toMovieReleaseNotice(
      SUBSCRIPTION_TRIGGER.RELEASE,
      row({
        theatricalReleaseDate: new Date('2026-11-18T00:00:00Z'),
        releases: [{ country: 'US', type: 3, date: '2026-11-18T00:00:00.000Z' }],
      }),
    );

    expect(notice).toEqual({
      releasedOn: new Date('2026-11-18T00:00:00Z'),
      kind: 'theatrical',
      country: 'US',
    });
  });

  it('labels a digital release by its digital date even when the movie was in cinemas', () => {
    const notice = toMovieReleaseNotice(
      SUBSCRIPTION_TRIGGER.ON_STREAMING,
      row({
        theatricalReleaseDate: new Date('2026-09-01T00:00:00Z'),
        digitalReleaseDate: new Date('2026-11-17T00:00:00Z'),
        releases: [{ country: 'US', type: 4, date: '2026-11-17T00:00:00.000Z' }],
      }),
    );

    expect(notice).toEqual({
      releasedOn: new Date('2026-11-17T00:00:00Z'),
      kind: 'digital',
      country: 'US',
    });
  });

  it('treats a cinema reminder for a digital-only movie as a digital release', () => {
    const notice = toMovieReleaseNotice(
      SUBSCRIPTION_TRIGGER.RELEASE,
      row({ digitalReleaseDate: new Date('2026-11-19T00:00:00Z') }),
    );

    expect(notice).toEqual(expect.objectContaining({ kind: 'digital', country: null }));
  });

  it('has nothing to say about a movie without a matching date', () => {
    expect(toMovieReleaseNotice(SUBSCRIPTION_TRIGGER.ON_STREAMING, row({}))).toBeNull();
    expect(toMovieReleaseNotice(SUBSCRIPTION_TRIGGER.RELEASE, row({}))).toBeNull();
  });
});
