/**
 * Aggregated counts of a user's lists that feed tab badges on the client.
 *
 * Buckets are mutually exclusive: a paused-with-progress item is counted
 * only in `paused`, never in `watching`. This keeps badge arithmetic
 * intuitive and avoids overlap with the Paused/Dropped tabs.
 */
export interface UserListCounts {
  watching: number;
  paused: number;
  dropped: number;
  completed: number;
  caughtUp: number;
  forLater: number;
  considering: number;
}
