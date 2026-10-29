import { type IClockPort } from '../../shared/clock';
import {
  IMPORT_PENDING_STATUS,
  LINK_PENDING_IMPORTS_BATCH_SIZE,
  LINK_PENDING_IMPORTS_INGEST_TIMEOUT_MS,
  LINK_PENDING_IMPORTS_MIN_AGE_MS,
  LINK_PENDING_IMPORTS_STALE_LINKING_MS,
} from '../domain/constants/import-pending.constants';
import { type ImportPendingItem } from '../domain/entities/import-pending-item';
import {
  type IImportPendingRepository,
  type PendingMediaLink,
} from '../domain/repositories/import-pending.repository.interface';

import { type LinkPendingImportsService } from './link-pending-imports.service';
import { LinkPendingImportsSweeper } from './link-pending-imports.sweeper';

const NOW = new Date('2026-10-29T12:00:00.000Z');

function makeLink(id: string): PendingMediaLink {
  const item = {
    id,
    batchId: 'batch-1',
    status: IMPORT_PENDING_STATUS.INGESTING,
    resolvedTmdbId: 550,
    mediaType: 'movie',
  } as ImportPendingItem;
  return { item, mediaItemId: `media-${id}` };
}

describe('LinkPendingImportsSweeper', () => {
  let pendingRepo: jest.Mocked<Pick<IImportPendingRepository, 'findLinkableWithReadyMedia'>>;
  let linkPendingImports: jest.Mocked<
    Pick<LinkPendingImportsService, 'linkItems' | 'failTimedOutIngests'>
  >;
  let sweeper: LinkPendingImportsSweeper;

  const ago = (ms: number) => new Date(NOW.getTime() - ms);

  beforeEach(() => {
    pendingRepo = { findLinkableWithReadyMedia: jest.fn().mockResolvedValue([]) };
    linkPendingImports = {
      linkItems: jest.fn().mockResolvedValue(0),
      failTimedOutIngests: jest.fn().mockResolvedValue(0),
    };
    const clock: IClockPort = { now: () => NOW };
    sweeper = new LinkPendingImportsSweeper(
      pendingRepo as unknown as IImportPendingRepository,
      clock,
      linkPendingImports as unknown as LinkPendingImportsService,
    );
  });

  it('looks at ingesting items past the minimum age and stale linking claims, in bounded batches', async () => {
    await sweeper.execute();

    expect(pendingRepo.findLinkableWithReadyMedia).toHaveBeenCalledWith({
      ingestingBefore: ago(LINK_PENDING_IMPORTS_MIN_AGE_MS),
      staleLinkingBefore: ago(LINK_PENDING_IMPORTS_STALE_LINKING_MS),
      limit: LINK_PENDING_IMPORTS_BATCH_SIZE,
    });
  });

  it('does not call the linker when no stuck item has ready media', async () => {
    await expect(sweeper.execute()).resolves.toEqual({ linked: 0, timedOut: 0 });

    expect(linkPendingImports.linkItems).not.toHaveBeenCalled();
  });

  it('links stuck items whose media is ready through the shared link service', async () => {
    const stuck = [makeLink('item-1'), makeLink('item-2')];
    pendingRepo.findLinkableWithReadyMedia.mockResolvedValue(stuck);
    linkPendingImports.linkItems.mockResolvedValue(2);

    await expect(sweeper.execute()).resolves.toEqual({ linked: 2, timedOut: 0 });

    expect(linkPendingImports.linkItems).toHaveBeenCalledWith(stuck);
  });

  it('fails ingests that never became ready within the timeout', async () => {
    linkPendingImports.failTimedOutIngests.mockResolvedValue(3);

    await expect(sweeper.execute()).resolves.toEqual({ linked: 0, timedOut: 3 });

    expect(linkPendingImports.failTimedOutIngests).toHaveBeenCalledWith(
      ago(LINK_PENDING_IMPORTS_INGEST_TIMEOUT_MS),
      LINK_PENDING_IMPORTS_BATCH_SIZE,
    );
  });
});
