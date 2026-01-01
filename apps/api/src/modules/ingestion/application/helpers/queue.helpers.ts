import { createHash } from 'crypto';

import { type Queue } from 'bullmq';

/**
 * Shared utilities for queue job deduplication and bulk operations.
 */

export interface PreDedupeResult<T> {
  jobsToAdd: T[];
  deduped: number;
  sample: string[];
}

// Default values for queue helpers
const DEFAULT_SAMPLE_SIZE = 3;
const DEFAULT_HASH_LENGTH = 12;
const DEFAULT_DEDUPE_CONCURRENCY = 50;

// ISO string slice length for hour window (YYYY-MM-DDTHH)
const ISO_HOUR_WINDOW_LENGTH = 13;

/**
 * Pre-deduplicates jobs by checking if they already exist in the queue.
 * Uses chunked parallel checks to avoid overwhelming Redis.
 *
 * @param jobs - Array of job definitions with opts.jobId
 * @param queue - BullMQ queue instance
 * @param concurrency - Number of parallel getJob checks (default: 50)
 * @param sampleSize - Number of jobIds to include in sample (default: 3)
 * @returns Object with jobsToAdd, deduped count, and sample jobIds
 */
export async function preDedupeBulk<T extends { opts?: { jobId: string } }>(
  jobs: T[],
  queue: Queue,
  concurrency = DEFAULT_DEDUPE_CONCURRENCY,
  sampleSize = DEFAULT_SAMPLE_SIZE,
): Promise<PreDedupeResult<T>> {
  let deduped = 0;
  const jobsToAdd: T[] = [];
  const sample: string[] = [];

  for (let i = 0; i < jobs.length; i += concurrency) {
    const chunk = jobs.slice(i, i + concurrency);
    const chunkChecks = await Promise.all(
      chunk.map(async (j) => {
        const jobId = j.opts?.jobId;
        if (!jobId) return { j, existing: null };
        const existing = await queue.getJob(jobId);
        return { j, existing };
      }),
    );

    for (const { j, existing } of chunkChecks) {
      if (existing) {
        deduped++;
        continue;
      }
      jobsToAdd.push(j);
      const id = j.opts?.jobId;
      if (id && sample.length < sampleSize) {
        sample.push(id);
      }
    }
  }

  return { jobsToAdd, deduped, sample };
}

/**
 * Creates a stable hash from an array of IDs.
 * Useful for generating deterministic jobIds based on content.
 *
 * @param ids - Array of numbers to hash
 * @param length - Length of hash to return (default: 12)
 * @returns Short hex hash string
 */
export function hashIds(ids: number[], length = DEFAULT_HASH_LENGTH): string {
  return createHash('sha1').update(ids.join(',')).digest('hex').slice(0, length);
}

/**
 * Formats a UTC hour window for job deduplication.
 * Format: YYYYMMDDHH (e.g., 2025122119 for Dec 21, 2025 19:00 UTC)
 *
 * @param date - Date to format (default: now)
 * @returns Hour window string
 */
export function formatHourWindow(date: Date = new Date()): string {
  return date.toISOString().slice(0, ISO_HOUR_WINDOW_LENGTH).replace(/[-T]/g, '');
}

/**
 * Formats sample jobIds for logging.
 *
 * @param sample - Array of jobIds
 * @returns Formatted string or empty string if no samples
 */
export function formatSample(sample: string[]): string {
  return sample.length > 0 ? `, sample=[${sample.join(',')}]` : '';
}

/**
 * Normalizes region string for consistent usage.
 * Returns 'global' for empty/null values, uppercase for valid regions.
 *
 * @param region - Region string to normalize
 * @returns Normalized region string
 */
export function normalizeRegion(region?: string | null): string {
  if (!region) return 'global';
  if (region.toLowerCase() === 'global') return 'global';
  const sanitized = region.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return sanitized.length > 0 ? sanitized : 'global';
}

/**
 * Splits an array into chunks of specified size.
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
