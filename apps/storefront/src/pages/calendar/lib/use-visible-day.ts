'use client';

import type { RefObject } from 'react';
import type { DateKey } from '../model/calendar-dates';
import { daySections, dayOfSection } from './day-anchor';
import { useScrollSyncedState } from './use-scroll-synced-state';

const READING_GAP_PX = 24;
const BOTTOM_TOLERANCE_PX = 2;

function isScrolledToBottom(): boolean {
  const { scrollHeight } = document.documentElement;
  return window.innerHeight + window.scrollY >= scrollHeight - BOTTOM_TOLERANCE_PX;
}

function dayAtReadingLine(container: HTMLElement, sticky: HTMLElement): DateKey | undefined {
  const sections = daySections(container);
  const readingLine = sticky.getBoundingClientRect().bottom + READING_GAP_PX;
  const limit = isScrolledToBottom() ? window.innerHeight : readingLine;
  const reached = sections.filter((section) => section.getBoundingClientRect().top <= limit);
  const lastReached = reached.at(-1);
  return lastReached && dayOfSection(lastReached);
}

export function useVisibleDay(
  container: RefObject<HTMLElement | null>,
  sticky: RefObject<HTMLElement | null>,
): DateKey | undefined {
  return useScrollSyncedState<DateKey | undefined>(
    undefined,
    () =>
      container.current && sticky.current
        ? { value: dayAtReadingLine(container.current, sticky.current) }
        : undefined,
    { watchedSubtree: container },
  );
}
