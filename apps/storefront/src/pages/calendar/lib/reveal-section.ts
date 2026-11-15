import { motionScrollBehavior } from '@/shared/lib';

export function revealSection(id: string): void {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: motionScrollBehavior(), block: 'start' });
  section.focus({ preventScroll: true });
}
