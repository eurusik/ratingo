export const RATING_PRESETS = [
  { id: 'bad', emoji: '💀', score: 15, min: 0, max: 29 },
  { id: 'okay', emoji: '😐', score: 50, min: 30, max: 69 },
  { id: 'good', emoji: '🙂', score: 75, min: 70, max: 84 },
  { id: 'top', emoji: '🔥', score: 90, min: 85, max: 100 },
] as const;

export type RatingPreset = (typeof RATING_PRESETS)[number];
export type RatingPresetId = RatingPreset['id'];

export const RATING_MIN = 0;
export const RATING_MAX = 100;
export const RATING_STEP = 5;

export function presetForRating(rating: number): RatingPreset | undefined {
  return RATING_PRESETS.find((preset) => rating >= preset.min && rating <= preset.max);
}

export function findPreset(id: string): RatingPreset | undefined {
  return RATING_PRESETS.find((preset) => preset.id === id);
}
