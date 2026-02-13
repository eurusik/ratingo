/**
 * Domain event emitted when a user changes their media state.
 *
 * `previousState` is `null` when the user had no prior state entry.
 *
 * Pure domain class — zero NestJS/infrastructure dependencies.
 */
export class UserMediaStateChangedEvent {
  static readonly eventName = 'user-media.state-changed';

  constructor(
    public readonly userId: string,
    public readonly mediaItemId: string,
    public readonly newState: string,
    public readonly previousState: string | null,
  ) {}
}
