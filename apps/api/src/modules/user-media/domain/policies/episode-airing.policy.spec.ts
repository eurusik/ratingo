import * as fc from 'fast-check';

import { hasEpisodeAired } from './episode-airing.policy';

const NOW_MS = 1_794_916_800_000;
const MAX_EPOCH_MS = 4_102_444_800_000;
const epochMsArb = fc.integer({ min: 0, max: MAX_EPOCH_MS });

describe('hasEpisodeAired', () => {
  it('treats an episode without an air date as not aired', () => {
    expect(hasEpisodeAired(null, NOW_MS)).toBe(false);
  });

  it('treats an episode airing exactly now as aired', () => {
    expect(hasEpisodeAired(NOW_MS, NOW_MS)).toBe(true);
  });

  it('treats an episode airing a millisecond later as not aired', () => {
    expect(hasEpisodeAired(NOW_MS + 1, NOW_MS)).toBe(false);
  });

  it('is aired exactly when the air date is not after now', () => {
    fc.assert(
      fc.property(epochMsArb, epochMsArb, (airMs, nowMs) => {
        expect(hasEpisodeAired(airMs, nowMs)).toBe(airMs <= nowMs);
      }),
    );
  });
});
