import { useSyncExternalStore } from 'react';

function subscribeToNothing() {
  return () => {};
}

export function useClientSnapshot<T>(readOnClient: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeToNothing, readOnClient, () => serverValue);
}
