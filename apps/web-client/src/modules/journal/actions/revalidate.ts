'use server';

/**
 * Server actions for revalidating journal pages.
 */

import { revalidatePath } from 'next/cache';

/**
 * Revalidates journal list page.
 */
export async function revalidateJournalList(): Promise<void> {
  revalidatePath('/journal');
}

/**
 * Revalidates a specific journal post page.
 */
export async function revalidateJournalPost(slug: string): Promise<void> {
  revalidatePath(`/journal/${slug}`);
}

/**
 * Revalidates all journal pages (list + specific post).
 */
export async function revalidateJournal(slug?: string): Promise<void> {
  revalidatePath('/journal');
  if (slug) {
    revalidatePath(`/journal/${slug}`);
  }
}
