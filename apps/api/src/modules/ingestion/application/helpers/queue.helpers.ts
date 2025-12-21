import { Queue } from 'bullmq';
import { createHash } from 'crypto';

/**
 * Shared utilities for queue job deduplication and bulk operations.
 */

export interface PreDedupeResult<T> {
  jobsToAdd: T[];
  deduped: number;
  sample: string[];
}

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
  concurrency = 50,
  sampleSize = 3,
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
export function hashIds(ids: number[], length = 12): string {
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
  return date.toISOString().slice(0, 13).replace(/[-T]/g, '');
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
