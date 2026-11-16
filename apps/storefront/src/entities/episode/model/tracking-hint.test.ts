import fc from 'fast-check';
import {
  hintsChangeForSession,
  isRememberableSlug,
  parseTrackingHints,
  signedInTrackingState,
  serializeTrackingHints,
  trackingStateFor,
  trackingStateOf,
  withTrackingState,
  type TrackingHints,
} from './tracking-hint';

const states = fc.constantFrom('start', 'watching', 'watching-next') as fc.Arbitrary<
  'start' | 'watching' | 'watching-next'
>;
const slugs = fc.stringMatching(/^[a-z0-9-]{1,24}$/);
const hintsArbitrary: fc.Arbitrary<TrackingHints> = fc
  .uniqueArray(fc.tuple(slugs, states), { selector: ([slug]) => slug, maxLength: 15 })
  .map((shows) => ({ shows }));

describe('tracking hints', () => {
  it('reads back exactly what was written', () => {
    fc.assert(
      fc.property(hintsArbitrary, (hints) => {
        expect(parseTrackingHints(serializeTrackingHints(hints))).toEqual(hints);
      }),
    );
  });

  it('puts the latest show first, once, and keeps at most fifteen', () => {
    fc.assert(
      fc.property(hintsArbitrary, slugs, states, (hints, slug, state) => {
        const next = withTrackingState(hints, slug, state);
        expect(next.shows[0]).toEqual([slug, state]);
        expect(next.shows.filter(([known]) => known === slug)).toHaveLength(1);
        expect(next.shows.length).toBeLessThanOrEqual(15);
      }),
    );
  });

  it('never throws on arbitrary cookie text', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const hints = parseTrackingHints(raw);
        expect(hints === null || Array.isArray(hints.shows)).toBe(true);
      }),
    );
    expect(parseTrackingHints('v2/pitt=w')).toBeNull();
    expect(parseTrackingHints('v1/pitt=x/%E0=w/bad slug=w')).toEqual({ shows: [] });
  });

  it('treats a missing cookie as a guest and an unknown show as not started', () => {
    expect(trackingStateFor(null, 'pitt')).toBe('guest');
    expect(trackingStateFor({ shows: [] }, 'pitt')).toBe('start');
    expect(trackingStateFor({ shows: [['pitt', 'watching-next']] }, 'pitt')).toBe('watching-next');
  });

  it('remembers only slugs that survive the cookie unchanged', () => {
    expect(isRememberableSlug('dune-part-two')).toBe(true);
    expect(isRememberableSlug('андор')).toBe(false);
    expect(isRememberableSlug('a/b')).toBe(false);
  });

  it('starts a signed-in viewer without a hint from the start card', () => {
    expect(signedInTrackingState(undefined)).toBe('start');
    expect(signedInTrackingState('guest')).toBe('start');
    expect(signedInTrackingState('watching')).toBe('watching');
  });

  it('forgets the hints only after a real sign-out', () => {
    const signedOut = { previousUserId: 'me', userId: null, hasHints: true };
    expect(hintsChangeForSession({ ...signedOut, hasRefreshToken: false })).toBe('forget');
    expect(hintsChangeForSession({ ...signedOut, hasRefreshToken: true })).toBe('keep');
    expect(hintsChangeForSession({ ...signedOut, hasRefreshToken: false, hasHints: false })).toBe(
      'keep',
    );
  });

  it('starts empty hints on sign-in and on a switch to another user', () => {
    const signedIn = { userId: 'me', hasRefreshToken: true };
    expect(hintsChangeForSession({ ...signedIn, previousUserId: null, hasHints: false })).toBe(
      'reset',
    );
    expect(hintsChangeForSession({ ...signedIn, previousUserId: 'other', hasHints: true })).toBe(
      'reset',
    );
    expect(hintsChangeForSession({ ...signedIn, previousUserId: 'me', hasHints: true })).toBe(
      'keep',
    );
    expect(hintsChangeForSession({ ...signedIn, previousUserId: null, hasHints: true })).toBe(
      'keep',
    );
  });

  it('never resets the hints of a signed-out viewer', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: null }),
        fc.boolean(),
        fc.boolean(),
        (previousUserId, hasRefreshToken, hasHints) => {
          const change = hintsChangeForSession({
            previousUserId,
            userId: null,
            hasRefreshToken,
            hasHints,
          });
          expect(change).not.toBe('reset');
        },
      ),
    );
  });

  it('derives the state from the watched count and the next episode', () => {
    expect(trackingStateOf(0, true)).toBe('start');
    expect(trackingStateOf(3, false)).toBe('watching');
    expect(trackingStateOf(3, true)).toBe('watching-next');
  });
});
