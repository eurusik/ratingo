export const SHARED_ART_SCOPE = { 'data-shared-art-scope': '' } as const;
export const SHARED_ART_SOURCE = { 'data-shared-art': '' } as const;
export const SHARED_ART_TARGET = { 'data-shared-art-target': '' } as const;

const SCOPE_SELECTOR = `[${Object.keys(SHARED_ART_SCOPE)[0]}]`;
const SOURCE_SELECTOR = `[${Object.keys(SHARED_ART_SOURCE)[0]}]`;
const ACTIVE_ATTRIBUTE = 'data-shared-art-active';

let currentlyActiveArt: HTMLElement | null = null;

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

function activate(art: HTMLElement | null): HTMLElement | null {
  currentlyActiveArt?.removeAttribute(ACTIVE_ATTRIBUTE);
  art?.setAttribute(ACTIVE_ATTRIBUTE, '');
  currentlyActiveArt = art;
  return art;
}

export function releaseSharedArt(art: HTMLElement | null): void {
  if (!art || art !== currentlyActiveArt) return;
  activate(null);
}

export function nameArtOfLink(link: Element): HTMLElement | null {
  return activate(artInside(link));
}

export function nameArtLinkingTo(pathname: string): HTMLElement | null {
  const links = document.querySelectorAll(`a[href="${CSS.escape(pathname)}"]`);
  const art = [...links].map(artInside).find((candidate) => candidate && isOnScreen(candidate));
  return activate(art ?? null);
}
