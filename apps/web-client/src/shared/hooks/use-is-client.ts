import { useClientSnapshot } from './use-client-snapshot';

function readIsClient() {
  return true;
}

export function useIsClient() {
  return useClientSnapshot(readIsClient, false);
}
