export function hasEpisodeAired(airDateMs: number | null, nowMs: number): boolean {
  return airDateMs !== null && airDateMs <= nowMs;
}
