/**
 * Normalizes origin countries and original language codes from TMDB API.
 * Uses format validation (ISO standards) instead of hardcoded lists.
 */

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/;

/**
 * Normalizes origin countries array from TMDB API.
 * Converts to uppercase, validates format, removes duplicates.
 *
 * @param {string[] | null | undefined} countries - Country codes from TMDB
 * @returns {string[] | null} Normalized array or null
 *
 * @example
 * normalizeOriginCountries(['us', 'gb']) // ['US', 'GB']
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
 * Converts to lowercase, validates ISO 639-1 format.
 *
 * @param {string | null | undefined} language - Language code from TMDB
 * @returns {string | null} Normalized code or null
 *
 * @example
 * normalizeOriginalLanguage('EN') // 'en'
 */
export function normalizeOriginalLanguage(language: string | null | undefined): string | null {
  if (!language || language.trim().length === 0) {
    return null;
  }

  const normalized = language.toLowerCase().trim();

  return LANGUAGE_CODE_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Checks if a country code has valid ISO 3166-1 alpha-2 format.
 *
 * @param {string} code - Country code to validate
 * @returns {boolean} True if valid format
 */
export function isValidCountryCode(code: string): boolean {
  return COUNTRY_CODE_PATTERN.test(code.toUpperCase());
}

/**
 * Checks if a language code has valid ISO 639-1 format.
 *
 * @param {string} code - Language code to validate
 * @returns {boolean} True if valid format
 */
export function isValidLanguageCode(code: string): boolean {
  return LANGUAGE_CODE_PATTERN.test(code.toLowerCase());
}
