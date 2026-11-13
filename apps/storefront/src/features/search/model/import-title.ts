import { catalogApi, type ImportJobStatus, type ImportResult, type MediaType } from '@/shared/api';

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 40;
const MAX_FAILED_POLLS_IN_A_ROW = 3;

export type TitleImportFailure = 'not-found' | 'failed' | 'timeout' | 'unreachable';

export class TitleImportError extends Error {
  constructor(readonly reason: TitleImportFailure) {
    super(`The title could not be imported: ${reason}`);
    this.name = 'TitleImportError';
  }
}

export interface ImportGateway {
  importMedia(type: MediaType, tmdbId: number): Promise<ImportResult>;
  getImportStatus(jobId: string, signal: AbortSignal): Promise<ImportJobStatus>;
  wait(ms: number, signal: AbortSignal): Promise<void>;
}

function waitUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

const apiGateway: ImportGateway = {
  importMedia: catalogApi.importMedia,
  getImportStatus: catalogApi.getImportStatus,
  wait: waitUnlessAborted,
};

function readySlug(result: ImportResult): string | null {
  const isAvailable = result.status === 'ready' || result.status === 'exists';
  return isAvailable && result.slug && result.ingestionStatus !== 'importing' ? result.slug : null;
}

async function pollOnce(
  jobId: string,
  signal: AbortSignal,
  gateway: ImportGateway,
): Promise<ImportJobStatus | null> {
  try {
    return await gateway.getImportStatus(jobId, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}

async function pollUntilReady(
  jobId: string,
  signal: AbortSignal,
  gateway: ImportGateway,
): Promise<string> {
  let failedPollsInARow = 0;
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    await gateway.wait(POLL_INTERVAL_MS, signal);
    const job = await pollOnce(jobId, signal, gateway);
    failedPollsInARow = job ? 0 : failedPollsInARow + 1;
    if (failedPollsInARow >= MAX_FAILED_POLLS_IN_A_ROW) throw new TitleImportError('unreachable');
    if (job?.status === 'ready' && job.slug) return job.slug;
    if (job?.status === 'failed') throw new TitleImportError('failed');
  }
  throw new TitleImportError('timeout');
}

export async function importUntilReady(
  type: MediaType,
  tmdbId: number,
  signal: AbortSignal,
  gateway: ImportGateway = apiGateway,
): Promise<string> {
  const result = await gateway.importMedia(type, tmdbId);
  const slug = readySlug(result);
  if (slug) return slug;
  if (!result.jobId)
    throw new TitleImportError(result.status === 'not_found' ? 'not-found' : 'failed');
  return pollUntilReady(result.jobId, signal, gateway);
}
