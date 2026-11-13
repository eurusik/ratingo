'use client';

import { useEffect } from 'react';
import { Kbd } from '@heroui/react';
import { useIsApplePlatform } from '@/shared/lib';
import { toggleSearch } from '../model/search-dialog-state';

const SHORTCUT_KEY = 'k';

export function SearchShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey || event.key.toLowerCase() !== SHORTCUT_KEY) return;
      event.preventDefault();
      toggleSearch();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}

export function SearchShortcutKbd({ className }: { className?: string }) {
  const isApple = useIsApplePlatform();
  const visibility = isApple === null ? 'opacity-0' : 'opacity-100';

  return (
    <Kbd
      className={`motion-safe:transition-opacity motion-safe:duration-200 ${visibility} ${className ?? ''}`}
      aria-hidden
    >
      <Kbd.Abbr keyValue={isApple === false ? 'ctrl' : 'command'} />
      <Kbd.Content>K</Kbd.Content>
    </Kbd>
  );
}
