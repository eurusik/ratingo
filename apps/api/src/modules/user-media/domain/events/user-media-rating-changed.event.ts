/**
 * Domain event emitted when a user changes a standalone rating.
 *
 * When `rating` is `null`, the user cleared (removed) their rating.
 *
 * Pure domain class — zero NestJS/infrastructure dependencies.
 */
export class UserMediaRatingChangedEvent {
  static readonly eventName = 'user-media.rating-changed';

  constructor(
    public readonly userId: string,
    public readonly mediaItemId: string,
    public readonly rating: number | null,
  ) {}
}
