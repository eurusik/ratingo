export const RATING_PRESETS = [
  { id: 'bad', emoji: '💀', score: 15, min: 0, max: 29 },
  { id: 'okay', emoji: '😐', score: 50, min: 30, max: 69 },
  { id: 'good', emoji: '🙂', score: 75, min: 70, max: 84 },
  { id: 'top', emoji: '🔥', score: 90, min: 85, max: 100 },
] as const;

export type RatingPresetId = (typeof RATING_PRESETS)[number]['id'];

export function findPresetByScore(score: number) {
  return RATING_PRESETS.find((p) => score >= p.min && score <= p.max) ?? null;
}
