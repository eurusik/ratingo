import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { MediaSyncedEvent } from '../../../ingestion/public';
import { LinkPendingImportsService } from '../link-pending-imports.service';

/**
 * Event listener that links newly ingested media items to pending import states.
 *
 * Triggered by 'media.synced' events emitted by SyncMediaService after
 * a full sync pipeline completes and catalog policy has been evaluated.
 * The link-pending-imports sweeper covers events that arrive before an item is INGESTING.
 */
@Injectable()
export class LinkImportListener {
  constructor(private readonly linkPendingImports: LinkPendingImportsService) {}

  @OnEvent(MediaSyncedEvent.eventName)
  async handleMediaSynced(event: MediaSyncedEvent): Promise<void> {
    await this.linkPendingImports.linkReadyMedia({
      tmdbId: event.tmdbId,
      type: event.type,
      mediaItemId: event.mediaItemId,
    });
  }
}
