export class ItemSavedForLaterEvent {
  static readonly eventName = 'user-actions.item-saved-for-later';

  constructor(
    public readonly userId: string,
    public readonly mediaItemId: string,
  ) {}
}
