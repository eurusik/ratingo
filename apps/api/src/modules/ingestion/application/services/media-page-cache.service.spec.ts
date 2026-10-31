import { MediaType } from '@/common/enums/media-type.enum';

import { MediaPageCacheService } from './media-page-cache.service';

describe('MediaPageCacheService', () => {
  let mediaRepository: { findByTmdbId: jest.Mock };
  let webPageCache: { invalidateMediaPage: jest.Mock };
  let service: MediaPageCacheService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    mediaRepository = { findByTmdbId: jest.fn() };
    webPageCache = { invalidateMediaPage: jest.fn().mockResolvedValue(undefined) };
    service = new MediaPageCacheService(mediaRepository as never, webPageCache);
    warn = jest.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn');
    warn.mockImplementation(() => undefined);
  });

  it('invalidates the page of the synced media by its slug', async () => {
    mediaRepository.findByTmdbId.mockResolvedValue({ id: 'm-1', slug: 'ted-lasso' });

    await service.invalidateAfterSync(97546, MediaType.SHOW);

    expect(mediaRepository.findByTmdbId).toHaveBeenCalledWith(97546, MediaType.SHOW);
    expect(webPageCache.invalidateMediaPage).toHaveBeenCalledWith(MediaType.SHOW, 'ted-lasso');
  });

  it('skips and logs a reason when the media is not in the catalog', async () => {
    mediaRepository.findByTmdbId.mockResolvedValue(null);

    await service.invalidateAfterSync(1, MediaType.MOVIE);

    expect(webPageCache.invalidateMediaPage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('media not found'));
  });

  it('logs and swallows a failed invalidation so the sync job still succeeds', async () => {
    mediaRepository.findByTmdbId.mockResolvedValue({ id: 'm-1', slug: 'dune' });
    webPageCache.invalidateMediaPage.mockRejectedValue(new Error('401 Unauthorized'));

    await expect(service.invalidateAfterSync(438631, MediaType.MOVIE)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('401 Unauthorized'));
  });
});
