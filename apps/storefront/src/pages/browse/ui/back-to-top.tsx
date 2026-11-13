'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

const VISIBLE_AFTER_SCREENS = 2;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function BackToTop() {
  const { dict } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const update = () => setIsVisible(window.scrollY > window.innerHeight * VISIBLE_AFTER_SCREENS);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  if (!isVisible) return null;

  const scrollToTop = () => {
    const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

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
