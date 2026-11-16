'use client';

import { useSyncExternalStore } from 'react';

const STANDALONE_DISPLAY_QUERY = '(display-mode: standalone)';
const IOS_DEVICE = /iPhone|iPad|iPod/;

interface IosNavigator extends Navigator {
  standalone?: boolean;
}

function isIosDevice(): boolean {
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return IOS_DEVICE.test(navigator.userAgent) || isTouchMac;
}

function isStandaloneApp(): boolean {
  const isHomeScreenApp = (navigator as IosNavigator).standalone === true;
  return isHomeScreenApp || window.matchMedia(STANDALONE_DISPLAY_QUERY).matches;
}

const subscribeToNothing = () => () => {};
const readIsInstalledIosApp = () => isIosDevice() && isStandaloneApp();
const readServerIsInstalledIosApp = () => false;

export function useIsInstalledIosApp(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    readIsInstalledIosApp,
    readServerIsInstalledIosApp,
  );
}
