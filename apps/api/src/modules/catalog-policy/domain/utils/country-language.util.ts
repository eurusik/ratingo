/**
 * Country and Language Normalization Utilities
 *
 * Normalizes origin countries and original language codes from TMDB API
 * to ensure consistent format for catalog policy evaluation.
 *
 * Requirements: 1.1
 */

// ISO 3166-1 alpha-2 country codes (subset of most common ones)
// Full list: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
const VALID_COUNTRY_CODES = new Set([
  'US',
  'GB',
  'CA',
  'AU',
  'NZ',
  'IE', // English-speaking
  'DE',
  'AT',
  'CH', // German-speaking
  'FR',
  'BE',
  'LU', // French-speaking
  'ES',
  'MX',
  'AR',
  'CO',
  'CL',
  'PE', // Spanish-speaking
  'IT',
  'BR',
  'PT',
  'NL',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'SK',
  'RU',
  'UA',
  'BY',
  'KZ', // Eastern Europe
  'JP',
  'KR',
  'CN',
  'TW',
  'HK',
  'SG',
  'TH',
  'VN',
  'IN',
  'ID',
  'MY',
  'PH',
  'TR',
  'IL',
  'SA',
  'AE',
  'EG',
  'ZA',
  'NG',
  'KE',
]);

// ISO 639-1 language codes (subset of most common ones)
// Full list: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
const VALID_LANGUAGE_CODES = new Set([
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'ja',
  'ko',
  'zh',
  'ar',
  'hi',
  'bn',
  'pa',
  'te',
  'mr',
  'ta',
  'ur',
  'gu',
  'kn',
  'ml',
  'or',
  'th',
  'vi',
  'id',
  'ms',
  'tl',
  'tr',
  'fa',
  'he',
  'uk',
  'pl',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'hr',
  'sr',
  'sl',
  'et',
  'lv',
  'lt',
  'el',
  'ca',
]);

/**
 * Normalizes origin countries array from TMDB API.
 *
 * - Converts to uppercase (ISO 3166-1 alpha-2 standard)
 * - Filters out invalid/unknown codes
 * - Removes duplicates
 * - Returns null if input is null/empty
 *
 * @param countries - Array of country codes from TMDB (e.g., ["us", "gb"])
 * @returns Normalized array or null
 *
 * @example
 * normalizeOriginCountries(['us', 'gb', 'invalid']) // ['US', 'GB']
 * normalizeOriginCountries([]) // null
 * normalizeOriginCountries(null) // null
 */
export function normalizeOriginCountries(countries: string[] | null | undefined): string[] | null {
  if (!countries || countries.length === 0) {
    return null;
  }

  const normalized = countries
    .map((code) => code.toUpperCase().trim())
    .filter((code) => VALID_COUNTRY_CODES.has(code));

  // Remove duplicates
  const unique = Array.from(new Set(normalized));

  return unique.length > 0 ? unique : null;
}

/**
 * Normalizes original language code from TMDB API.
 *
 * - Converts to lowercase (ISO 639-1 standard)
 * - Validates against known language codes
 * - Returns null if invalid or empty
 *
 * @param language - Language code from TMDB (e.g., "EN", "en")
 * @returns Normalized code or null
 *
 * @example
 * normalizeOriginalLanguage('EN') // 'en'
 * normalizeOriginalLanguage('invalid') // null
 * normalizeOriginalLanguage('') // null
 */
export function normalizeOriginalLanguage(language: string | null | undefined): string | null {
  if (!language || language.trim().length === 0) {
    return null;
  }

  const normalized = language.toLowerCase().trim();

  return VALID_LANGUAGE_CODES.has(normalized) ? normalized : null;
}

/**
 * Checks if a country code is valid (for testing/validation).
 */
export function isValidCountryCode(code: string): boolean {
  return VALID_COUNTRY_CODES.has(code.toUpperCase());
}

/**
 * Checks if a language code is valid (for testing/validation).
 */
export function isValidLanguageCode(code: string): boolean {
  return VALID_LANGUAGE_CODES.has(code.toLowerCase());
}
