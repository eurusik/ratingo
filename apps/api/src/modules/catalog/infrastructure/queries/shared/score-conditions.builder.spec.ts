import * as fc from 'fast-check';

import { buildShowScoreConditions, buildMovieScoreConditions } from './score-conditions.builder';

const optionalScore = fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined });

describe('score-conditions.builder', () => {
  it.each([
    ['buildMovieScoreConditions', buildMovieScoreConditions],
    ['buildShowScoreConditions', buildShowScoreConditions],
  ])('%s adds one condition per score filter that is set', (_name, build) => {
    fc.assert(
      fc.property(optionalScore, optionalScore, (minRatingo, minQuality) => {
        const expected = [minRatingo, minQuality].filter((value) => value !== undefined).length;
        expect(build({ minRatingo, minQuality })).toHaveLength(expected);
      }),
    );
  });

  it('keeps a zero threshold as a real filter', () => {
    expect(buildMovieScoreConditions({ minQuality: 0 })).toHaveLength(1);
    expect(buildShowScoreConditions({ minRatingo: 0 })).toHaveLength(1);
  });
});
