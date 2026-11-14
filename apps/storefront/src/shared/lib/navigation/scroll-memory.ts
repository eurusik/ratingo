import { reportNavigationStep } from '@ratingo/ui/motion';

const RAIL_MEMORY_ATTRIBUTE = 'data-rail-memory';

const scrollByLocation = new Map<string, number>();
const railScrollByLocation = new Map<string, number>();

export function currentLocationKey(): string {
  return window.location.pathname + window.location.search;
}

function railMemoryKey(railKey: string): string {
  return `${currentLocationKey()}#${railKey}`;
}

export function railMemoryMarker(railKey: string) {
  return { [RAIL_MEMORY_ATTRIBUTE]: railKey };
}

function rememberRailPositions(): void {
  for (const rail of document.querySelectorAll<HTMLElement>(`[${RAIL_MEMORY_ATTRIBUTE}]`)) {
    const railKey = rail.getAttribute(RAIL_MEMORY_ATTRIBUTE) ?? '';
    railScrollByLocation.set(railMemoryKey(railKey), rail.scrollLeft);
  }
}

export function rememberWindowScroll(): void {
  scrollByLocation.set(currentLocationKey(), window.scrollY);
}

export function rememberScroll(): void {
  rememberWindowScroll();
  rememberRailPositions();
}

function takeRemembered(memory: Map<string, number>, key: string): number | undefined {
  const remembered = memory.get(key);
  memory.delete(key);
  return remembered;
}

export function restoreRememberedScroll(): void {
  const rememberedY = takeRemembered(scrollByLocation, currentLocationKey());
  if (rememberedY === undefined) return;
  window.scrollTo(0, rememberedY);
  reportNavigationStep('scroll-restored', { y: rememberedY });
}

export function restoreRememberedRailScroll(rail: HTMLElement, railKey: string): void {
  const rememberedX = takeRemembered(railScrollByLocation, railMemoryKey(railKey));
  if (rememberedX !== undefined) rail.scrollLeft = rememberedX;
}
