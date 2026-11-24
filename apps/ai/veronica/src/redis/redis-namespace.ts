const KEY_SEPARATOR = ':';

export interface QueueIdentity {
  prefix: string;
  name: string;
}

export const queueNamespace = ({ prefix, name }: QueueIdentity): string =>
  `${prefix}${KEY_SEPARATOR}${name}${KEY_SEPARATOR}`;

export const queueKey = (queue: QueueIdentity, suffix: string): string =>
  `${queueNamespace(queue)}${suffix}`;

export const collidesWithQueue = (key: string, queues: readonly QueueIdentity[]): boolean =>
  queues.some((queue) => key.startsWith(queueNamespace(queue)));
