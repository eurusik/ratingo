import { nanoid } from 'nanoid';
import slugify from 'slugify';

/** Length of nanoid suffix for fallback slugs */
const NANOID_LENGTH = 8;

/**
 * Generates a URL-friendly slug from a title.
 * Supports Ukrainian locale for proper transliteration.
 * Falls back to `post-<nanoid>` if slugify produces empty result.
 *
 * @param title - Post title
 * @returns URL-friendly slug
 */
export function generateSlug(title: string): string {
  const slug = slugify(title, {
    lower: true,
    strict: true,
    locale: 'uk',
  });

  // Fallback for empty slugs (e.g., emoji-only titles, edge cases)
  if (!slug || slug.length === 0) {
    return `post-${nanoid(NANOID_LENGTH)}`;
  }

  return slug;
}

/**
 * Ensures the slug is unique by appending a counter if necessary.
 *
 * @param baseSlug - The initial slug to check
 * @param existsBySlug - Function to check if a slug exists in the database
 * @returns A unique slug
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  existsBySlug: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await existsBySlug(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
