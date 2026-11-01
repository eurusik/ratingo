import { MediaSyncedEvent } from '../../../ingestion/public';
import { type LinkPendingImportsService } from '../link-pending-imports.service';

import { LinkImportListener } from './link-import.listener';

describe('LinkImportListener', () => {
  it('links the pending imports waiting for the synced media', async () => {
    const linkPendingImports: jest.Mocked<Pick<LinkPendingImportsService, 'linkReadyMedia'>> = {
      linkReadyMedia: jest.fn().mockResolvedValue(1),
    };
    const listener = new LinkImportListener(
      linkPendingImports as unknown as LinkPendingImportsService,
    );

    await listener.handleMediaSynced(new MediaSyncedEvent(1399, 'show', 'media-uuid-2'));

    expect(linkPendingImports.linkReadyMedia).toHaveBeenCalledWith({
      tmdbId: 1399,
      type: 'show',
      mediaItemId: 'media-uuid-2',
    });
  });
});
