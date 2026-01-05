/**
 * Region constants for watch providers availability.
 *
 * Business logic: Ukrainian product with US fallback.
 * - UA: Primary region for Ukrainian users
 * - US: Fallback when UA providers unavailable (broader catalog)
 */

/** Primary region for availability lookup */
export const PRIMARY_REGION = 'UA';

/** Fallback region when primary has no providers */
export const FALLBACK_REGION = 'US';

/** Regions to fetch for availability (ordered by priority) */
export const AVAILABILITY_REGIONS = [PRIMARY_REGION, FALLBACK_REGION] as const;

/** Type for supported availability regions */
export type AvailabilityRegion = (typeof AVAILABILITY_REGIONS)[number];
