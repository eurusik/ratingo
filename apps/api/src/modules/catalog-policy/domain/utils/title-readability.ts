/**
 * Title Readability Utilities
 *
 * Pure functions for checking title readability for UA audience.
 * Used by PolicyEngine for display gate checks.
 */

/**
 * Constants for readability rules.
 */
const MIN_LATIN_CYRILLIC_FOR_READABLE = 2;

/**
 * Checks if title is readable for UA audience.
 *
 * Rules:
 * 1. If title has 2+ Latin/Cyrillic letters -> readable (regardless of other chars)
 * 2. If title has CJK characters but <2 Latin/Cyrillic -> unreadable
 * 3. Otherwise -> readable (numbers, punctuation, etc.)
 *
 * NO exceptions for short titles. 功夫 is not readable for UA users.
 * In the future, titles with known global aliases (e.g. 功夫 → Kung Fu)
 * may be allowed if alias resolution is available.
 *
 * @param title - Display title to check
 * @returns true if readable, false if CJK without translation
 */
export function isReadableTitle(title: string): boolean {
  if (!title || title.length === 0) {
    return false; // Empty title handled by data integrity check
  }

  // Count character types (letters only, not digits/punctuation)
  // Using Unicode property escapes for script detection
  const latinCyrillicRegex = /[\p{Script=Latin}\p{Script=Cyrillic}]/gu;
  const cjkRegex = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

  const latinCyrillicMatches = title.match(latinCyrillicRegex) || [];
  const cjkMatches = title.match(cjkRegex) || [];

  const latinCyrillicCount = latinCyrillicMatches.length;
  const cjkCount = cjkMatches.length;

  // Rule 1: 2+ Latin/Cyrillic letters = always readable
  if (latinCyrillicCount >= MIN_LATIN_CYRILLIC_FOR_READABLE) {
    return true;
  }

  // Rule 2: Any CJK without sufficient Latin/Cyrillic = unreadable
  // No exception for short titles - 功夫 is not readable for UA users
  if (cjkCount > 0) {
    return false;
  }

  // Rule 3: No CJK and no Latin/Cyrillic (numbers, punctuation only) = readable
  // Edge case: titles like "2001" or "1984" should be readable
  return true;
}
