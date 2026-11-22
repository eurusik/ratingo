export interface NotificationMessage {
  html: string;
  silent: boolean;
}

export interface NotifierPort {
  send(message: NotificationMessage): Promise<void>;
}

export const NOTIFIER_PORT = Symbol('NOTIFIER_PORT');

export class NotificationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean = true,
    readonly deliveryUnknown: boolean = false,
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}
