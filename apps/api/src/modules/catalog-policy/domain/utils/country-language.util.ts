/**
 * Country and Language Normalization Utilities
 *
 * Normalizes origin countries and original language codes from TMDB API
 * to ensure consistent format for catalog policy evaluation.
 *
 * Uses format validation (ISO standards) instead of hardcoded lists
 * to avoid filtering out valid codes from TMDB.
 */

/** ISO 3166-1 alpha-2 country code pattern (2 uppercase letters) */
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/** ISO 639-1 language code pattern (2 lowercase letters) */
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/;

/**
 * Normalizes origin countries array from TMDB API.
 *
 * - Converts to uppercase (ISO 3166-1 alpha-2 standard)
 * - Validates format (2 uppercase letters)
 * - Removes duplicates
 * - Returns null if input is null/empty
 *
 * @param countries - Array of country codes from TMDB (e.g., ["us", "gb"])
 * @returns Normalized array or null
 *
 * @example
 * normalizeOriginCountries(['us', 'gb']) // ['US', 'GB']
 * normalizeOriginCountries(['us', 'invalid123']) // ['US']
 * normalizeOriginCountries([]) // null
 * normalizeOriginCountries(null) // null
 */
export function normalizeOriginCountries(countries: string[] | null | undefined): string[] | null {
  if (!countries || countries.length === 0) {
    return null;
  }

  const normalized = countries
    .map((code) => code.toUpperCase().trim())
    .filter((code) => COUNTRY_CODE_PATTERN.test(code));

  // Remove duplicates
  const unique = Array.from(new Set(normalized));

  return unique.length > 0 ? unique : null;
}

/**
 * Normalizes original language code from TMDB API.
 *
 * - Converts to lowercase (ISO 639-1 standard)
 * - Validates format (2 lowercase letters)
 * - Returns null if invalid or empty
 *
 * @param language - Language code from TMDB (e.g., "EN", "en")
 * @returns Normalized code or null
 *
 * @example
 * normalizeOriginalLanguage('EN') // 'en'
 * normalizeOriginalLanguage('invalid123') // null
 * normalizeOriginalLanguage('') // null
 */
export function normalizeOriginalLanguage(language: string | null | undefined): string | null {
  if (!language || language.trim().length === 0) {
    return null;
  }

  const normalized = language.toLowerCase().trim();

  return LANGUAGE_CODE_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Checks if a country code has valid format (ISO 3166-1 alpha-2).
 *
 * @param code - Country code to validate
 * @returns True if valid format (2 uppercase letters)
 */
export function isValidCountryCode(code: string): boolean {
  return COUNTRY_CODE_PATTERN.test(code.toUpperCase());
}

/**
 * Checks if a language code has valid format (ISO 639-1).
 *
 * @param code - Language code to validate
 * @returns True if valid format (2 lowercase letters)
 */
export function isValidLanguageCode(code: string): boolean {
  return LANGUAGE_CODE_PATTERN.test(code.toLowerCase());
}
