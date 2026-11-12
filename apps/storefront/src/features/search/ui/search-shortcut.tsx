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

  return (
    <Kbd className={className} aria-hidden>
      <Kbd.Abbr keyValue={isApple ? 'command' : 'ctrl'} />
      <Kbd.Content>K</Kbd.Content>
    </Kbd>
  );
}
