import { catalogApi, type ImportJobStatus, type ImportResult } from '@/shared/api';
import { importUntilReady, TitleImportError, type ImportGateway } from './import-title';

jest.mock('@/shared/api', () => ({
  catalogApi: { importMedia: jest.fn(), getImportStatus: jest.fn() },
}));

const STILL_PROCESSING: ImportJobStatus = { status: 'processing' };
const signal = new AbortController().signal;

function gateway(result: ImportResult, statuses: ImportJobStatus[] = []): ImportGateway {
  const queue = [...statuses];
  return {
    importMedia: jest.fn().mockResolvedValue(result),
    getImportStatus: jest.fn(async () => queue.shift() ?? STILL_PROCESSING),
    wait: jest.fn().mockResolvedValue(undefined),
  };
}

describe('importUntilReady', () => {
  it('opens a title the catalog already has', async () => {
    const api = gateway({ status: 'exists', type: 'movie', tmdbId: 1, slug: 'dune-1984' });

    await expect(importUntilReady('movie', 1, signal, api)).resolves.toBe('dune-1984');
    expect(api.getImportStatus).not.toHaveBeenCalled();
  });

  it('polls the import job until the page is ready', async () => {
    const api = gateway({ status: 'importing', type: 'show', tmdbId: 2, jobId: 'job-1' }, [
      { status: 'queued' },
      { status: 'processing' },
      { status: 'ready', slug: 'children-of-dune' },
    ]);

    await expect(importUntilReady('show', 2, signal, api)).resolves.toBe('children-of-dune');
    expect(api.getImportStatus).toHaveBeenCalledTimes(3);
  });

  it('rides out a couple of failed polls', async () => {
    const api = gateway({ status: 'importing', type: 'show', tmdbId: 5, jobId: 'job-5' });
    jest
      .mocked(api.getImportStatus)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValueOnce({ status: 'ready', slug: 'andor' });

    await expect(importUntilReady('show', 5, signal, api)).resolves.toBe('andor');
  });

  it('gives up when the status endpoint keeps failing', async () => {
    const api = gateway({ status: 'importing', type: 'show', tmdbId: 6, jobId: 'job-6' });
    jest.mocked(api.getImportStatus).mockRejectedValue(new Error('network'));

    await expect(importUntilReady('show', 6, signal, api)).rejects.toMatchObject({
      reason: 'unreachable',
    });
    expect(api.getImportStatus).toHaveBeenCalledTimes(3);
  });

  it.each<[string, ImportResult, ImportJobStatus[]]>([
    [
      'the job fails',
      { status: 'importing', type: 'movie', tmdbId: 3, jobId: 'job-2' },
      [{ status: 'failed' }],
    ],
    ['TMDB has no such title', { status: 'not_found', type: 'movie', tmdbId: 3 }, []],
    [
      'the job never finishes',
      { status: 'importing', type: 'movie', tmdbId: 3, jobId: 'job-3' },
      [],
    ],
  ])('fails when %s', async (_case, result, statuses) => {
    await expect(
      importUntilReady('movie', 3, signal, gateway(result, statuses)),
    ).rejects.toBeInstanceOf(TitleImportError);
  });
});

describe('importUntilReady cancellation', () => {
  it('stops before polling when the search was already closed', async () => {
    jest.mocked(catalogApi.importMedia).mockResolvedValue({
      status: 'importing',
      type: 'movie',
      tmdbId: 4,
      jobId: 'job-4',
    });
    const controller = new AbortController();
    controller.abort();

    await expect(importUntilReady('movie', 4, controller.signal)).rejects.toBeDefined();
    expect(catalogApi.getImportStatus).not.toHaveBeenCalled();
  });
});
