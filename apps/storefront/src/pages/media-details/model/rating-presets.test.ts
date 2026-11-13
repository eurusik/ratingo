import fc from 'fast-check';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_PRESETS,
  findPreset,
  presetForRating,
} from './rating-presets';

describe('rating presets', () => {
  it('maps every rating on the scale to exactly one preset', () => {
    fc.assert(
      fc.property(fc.integer({ min: RATING_MIN, max: RATING_MAX }), (rating) => {
        const matches = RATING_PRESETS.filter(({ min, max }) => rating >= min && rating <= max);
        expect(matches).toHaveLength(1);
        expect(presetForRating(rating)).toBe(matches[0]);
      }),
    );
  });

  it('keeps each preset score inside its own range', () => {
    RATING_PRESETS.forEach((preset) => expect(presetForRating(preset.score)).toBe(preset));
  });

  it('stores the scores the API expects', () => {
    expect(RATING_PRESETS.map(({ score }) => score)).toEqual([15, 50, 75, 90]);
  });

  it('finds presets by id and ignores unknown ids', () => {
    expect(findPreset('top')?.score).toBe(90);
    expect(findPreset('meh')).toBeUndefined();
  });
});
