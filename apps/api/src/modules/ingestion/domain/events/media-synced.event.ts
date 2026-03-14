/**
 * Domain event emitted by SyncMediaService after a media item is fully synced
 * and catalog policy has been evaluated.
 *
 * Consumed by LinkImportListener in user-media module to link pending import items
 * to the newly ingested catalog entry.
 *
 * Pure domain class — zero NestJS/infrastructure dependencies.
 */
export class MediaSyncedEvent {
  static readonly eventName = 'media.synced';

  constructor(
    /** TMDB ID of the synced media item. */
    public readonly tmdbId: number,
    /** Media type: 'movie' or 'show'. */
    public readonly type: 'movie' | 'show',
    /** Internal catalog media_item UUID. */
    public readonly mediaItemId: string,
  ) {}
}
