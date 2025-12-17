/**
 * Ratingo Release Status - computed based on release dates
 * Used for verdict generation and UI display
 */
export enum ReleaseStatus {
  /** Not yet released anywhere */
  UPCOMING = 'upcoming',
  /** Released in theaters, not yet on streaming */
  IN_THEATERS = 'in_theaters',
  /** Available on streaming platforms */
  STREAMING = 'streaming',
  /** Recently released on streaming (within 14 days) */
  NEW_ON_STREAMING = 'new_on_streaming',
}
