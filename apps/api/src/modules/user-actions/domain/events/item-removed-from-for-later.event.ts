export class ItemRemovedFromForLaterEvent {
  static readonly eventName = 'user-actions.item-removed-from-for-later';

  constructor(
    public readonly userId: string,
    public readonly mediaItemId: string,
  ) {}
}
