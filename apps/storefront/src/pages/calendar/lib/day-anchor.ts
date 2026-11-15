import type { DateKey } from '../model/calendar-dates';

const DAY_SELECTOR = '[data-day]';

export function dayAnchor(key: DateKey): string {
  return `day-${key}`;
}

export function dayHeadingId(key: DateKey): string {
  return `${dayAnchor(key)}-heading`;
}

export function daySectionProps(key: DateKey) {
  return { id: dayAnchor(key), 'data-day': key };
}

export function daySections(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(DAY_SELECTOR)];
}

export function dayOfSection(section: HTMLElement): DateKey | undefined {
  return section.dataset.day;
}
