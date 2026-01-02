/**
 * Region Normalizer Utility
 *
 * Normalizes region codes to consistent format for provider mappings.
 * Returns 'global' for undefined/empty or ISO 3166-1 alpha-2 uppercase.
 */

/** Special region value for global/worldwide mappings */
export const GLOBAL_REGION = 'global';

/** Common region code aliases that need special handling */
const REGION_ALIASES: Record<string, string> = {
  uk: 'GB', // United Kingdom uses GB in ISO 3166-1
  en: 'GB', // Sometimes 'en' is used incorrectly for UK
};

/**
 * Normalizes a region string to consistent format.
 *
 * @param region - Raw region string (can be undefined, empty, or any case)
 * @returns 'global' for undefined/empty, or uppercase ISO 3166-1 alpha-2 code
 *
 * @example
 * normalizeRegion(undefined) // 'global'
 * normalizeRegion('') // 'global'
 * normalizeRegion('us') // 'US'
 * normalizeRegion('UK') // 'GB'
 * normalizeRegion('ua') // 'UA'
 */
export function normalizeRegion(region?: string | null): string {
  // Handle undefined, null, or empty string
  if (!region || region.trim() === '') {
    return GLOBAL_REGION;
  }

  const trimmed = region.trim().toLowerCase();

  // Handle 'global' explicitly
  if (trimmed === GLOBAL_REGION) {
    return GLOBAL_REGION;
  }

  // Check for aliases first
  if (REGION_ALIASES[trimmed]) {
    return REGION_ALIASES[trimmed];
  }

  // Return uppercase version
  return trimmed.toUpperCase();
}

/**
 * Checks if a region is the global region.
 */
export function isGlobalRegion(region: string): boolean {
  return region === GLOBAL_REGION;
}

/**
 * Validates if a string looks like a valid ISO 3166-1 alpha-2 code.
 * Does not check against actual country list, just format.
 */
export function isValidRegionFormat(region: string): boolean {
  if (region === GLOBAL_REGION) {
    return true;
  }
  return /^[A-Z]{2}$/.test(region);
}
