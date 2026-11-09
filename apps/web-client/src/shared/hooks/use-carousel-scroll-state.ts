import { useCallback, useSyncExternalStore } from 'react';
import type { UseEmblaCarouselType } from 'embla-carousel-react';

type CarouselApi = UseEmblaCarouselType[1];

const SCROLL_STATE_EVENTS = ['select', 'reInit'] as const;

function getServerSnapshot() {
  return false;
}

export function useCarouselScrollState(api: CarouselApi) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      SCROLL_STATE_EVENTS.forEach((event) => api.on(event, onChange));
      return () => SCROLL_STATE_EVENTS.forEach((event) => api.off(event, onChange));
    },
    [api],
  );

  const canScrollPrev = useSyncExternalStore(
    subscribe,
    () => api?.canScrollPrev() ?? false,
    getServerSnapshot,
  );
  const canScrollNext = useSyncExternalStore(
    subscribe,
    () => api?.canScrollNext() ?? false,
    getServerSnapshot,
  );

  return { canScrollPrev, canScrollNext };
}
