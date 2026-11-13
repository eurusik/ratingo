export const SHARED_ART_SCOPE = { 'data-shared-art-scope': '' } as const;
export const SHARED_ART_SOURCE = { 'data-shared-art': '' } as const;
export const SHARED_ART_TARGET = { 'data-shared-art-target': '' } as const;

const SCOPE_SELECTOR = '[data-shared-art-scope]';
const SOURCE_SELECTOR = '[data-shared-art]';
const SHARED_ART_NAME = 'media-art';
const SHARED_ART_CLASS = 'morph';

let namedArt: HTMLElement | null = null;

function artInside(link: Element): HTMLElement | null {
  const scope = link.closest(SCOPE_SELECTOR) ?? link;
  return scope.querySelector<HTMLElement>(SOURCE_SELECTOR);
}

function isOnScreen(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

function nameArt(art: HTMLElement | null): void {
  clearSharedArt();
  if (!art) return;
  art.style.setProperty('view-transition-name', SHARED_ART_NAME);
  art.style.setProperty('view-transition-class', SHARED_ART_CLASS);
  namedArt = art;
}

export function clearSharedArt(): void {
  namedArt?.style.removeProperty('view-transition-name');
  namedArt?.style.removeProperty('view-transition-class');
  namedArt = null;
}

export function nameArtOfLink(link: Element): void {
  nameArt(artInside(link));
}

export function nameArtLinkingTo(pathname: string): void {
  const links = document.querySelectorAll(`a[href="${CSS.escape(pathname)}"]`);
  const art = [...links].map(artInside).find((candidate) => candidate && isOnScreen(candidate));
  nameArt(art ?? null);
}
