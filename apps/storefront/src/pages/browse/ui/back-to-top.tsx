'use client';

import { useLayoutEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { currentLocationKey } from '@/shared/lib';
import { MAIN_CONTENT_ID } from '@/shared/ui';

const VISIBLE_AFTER_SCREENS = 2;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const visibilityByLocation = new Map<string, boolean>();

function rememberedVisibility(): boolean {
  if (typeof window === 'undefined') return false;
  return visibilityByLocation.get(currentLocationKey()) ?? false;
}

function isScrolledFarEnough(): boolean {
  return window.scrollY > window.innerHeight * VISIBLE_AFTER_SCREENS;
}

function scheduleFirstUpdate(update: () => void): () => void {
  const isReturning = visibilityByLocation.has(currentLocationKey());
  if (!isReturning) {
    update();
    return () => {};
  }
  const frame = requestAnimationFrame(update);
  return () => cancelAnimationFrame(frame);
}

function scrollToTop(): void {
  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
}

export function BackToTop() {
  const { dict } = useTranslation();
  const [isVisible, setIsVisible] = useState(rememberedVisibility);

  useLayoutEffect(() => {
    const update = () => {
      const next = isScrolledFarEnough();
      visibilityByLocation.set(currentLocationKey(), next);
      setIsVisible(next);
    };
    const cancelFirstUpdate = scheduleFirstUpdate(update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelFirstUpdate();
      window.removeEventListener('scroll', update);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <Button
      variant="secondary"
      onPress={scrollToTop}
      className="fixed bottom-[calc(var(--tab-bar-height)+var(--safe-bottom)+1.5rem)] left-1/2 z-30 -translate-x-1/2 gap-1.5 rounded-full shadow-overlay md:bottom-8"
    >
      <ArrowUp aria-hidden className="size-4" />
      {dict.browse.backToTop}
    </Button>
  );
}
