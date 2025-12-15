/**
 * Utility for merging Tailwind CSS classes.
 *
 * Combines clsx for conditional classes with tailwind-merge
 * for proper handling of conflicting Tailwind utilities.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'px-6')
 * // => 'py-2 bg-blue-500 px-6' (px-6 overrides px-4)
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names with Tailwind conflict resolution.
 *
 * @param inputs - Class values (strings, objects, arrays)
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
