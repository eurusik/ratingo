import { type IClockPort } from '../../shared/clock';
import {
  IMPORT_PENDING_STATUS,
  LINK_PENDING_IMPORTS_BATCH_SIZE,
  LINK_PENDING_IMPORTS_MIN_AGE_MS,
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
  let pendingRepo: jest.Mocked<Pick<IImportPendingRepository, 'findIngestingWithReadyMedia'>>;
  let linkPendingImports: jest.Mocked<Pick<LinkPendingImportsService, 'linkItems'>>;
  let sweeper: LinkPendingImportsSweeper;

  beforeEach(() => {
    pendingRepo = { findIngestingWithReadyMedia: jest.fn().mockResolvedValue([]) };
    linkPendingImports = { linkItems: jest.fn().mockResolvedValue(0) };
    const clock: IClockPort = { now: () => NOW };
    sweeper = new LinkPendingImportsSweeper(
      pendingRepo as unknown as IImportPendingRepository,
      clock,
      linkPendingImports as unknown as LinkPendingImportsService,
    );
  });

  it('only looks at items stuck longer than the minimum age, in bounded batches', async () => {
    await sweeper.execute();

    expect(pendingRepo.findIngestingWithReadyMedia).toHaveBeenCalledWith(
      new Date(NOW.getTime() - LINK_PENDING_IMPORTS_MIN_AGE_MS),
      LINK_PENDING_IMPORTS_BATCH_SIZE,
    );
  });

  it('does nothing when no stuck item has ready media', async () => {
    await expect(sweeper.execute()).resolves.toBe(0);

    expect(linkPendingImports.linkItems).not.toHaveBeenCalled();
  });

  it('links stuck items whose media is ready through the shared link service', async () => {
    const stuck = [makeLink('item-1'), makeLink('item-2')];
    pendingRepo.findIngestingWithReadyMedia.mockResolvedValue(stuck);
    linkPendingImports.linkItems.mockResolvedValue(2);

    await expect(sweeper.execute()).resolves.toBe(2);

    expect(linkPendingImports.linkItems).toHaveBeenCalledWith(stuck);
  });
});
