export const SUBSCRIPTIONS_KEY = ['subscriptions'] as const;

export function remindedShowsKey(userId: string | null) {
  return [...SUBSCRIPTIONS_KEY, 'reminders', userId] as const;
}

export function followedTitlesKey(userId: string | null) {
  return [...SUBSCRIPTIONS_KEY, 'followed', userId] as const;
}
