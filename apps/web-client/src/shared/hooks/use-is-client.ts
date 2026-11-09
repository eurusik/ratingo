import { useSyncExternalStore } from 'react';

function subscribeToNothing() {
  return () => {};
}

function readIsClient() {
  return true;
}

function readIsClientOnServer() {
  return false;
}

export function useIsClient() {
  return useSyncExternalStore(subscribeToNothing, readIsClient, readIsClientOnServer);
}
