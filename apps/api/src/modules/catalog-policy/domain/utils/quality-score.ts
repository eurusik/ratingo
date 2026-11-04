export function meetsMinQualityScore(
  qualityScore: number | null | undefined,
  minQualityScoreNormalized: number,
): boolean {
  return Number.isFinite(qualityScore) && qualityScore >= minQualityScoreNormalized;
}
