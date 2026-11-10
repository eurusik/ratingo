'use server';

/**
 * Server actions for revalidating journal pages.
 */

import { revalidatePath } from 'next/cache';

/**
 * Revalidates all journal pages (list + specific post).
 */
export async function revalidateJournal(slug?: string): Promise<void> {
  revalidatePath('/journal');
  if (slug) {
    revalidatePath(`/journal/${slug}`);
  }
}
