'use client';

import { useCallback, useRef, type KeyboardEvent } from 'react';

const ROW_SELECTOR = '[role="row"][data-key]';

export function useResultsKeyboard(openFirstResult: () => boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement | null>(null);

  const firstRow = () => list.current?.querySelector<HTMLElement>(ROW_SELECTOR) ?? null;

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      const row = firstRow();
      if (!row) return;
      event.preventDefault();
      row.focus();
    } else if (event.key === 'Enter' && openFirstResult()) {
      event.preventDefault();
    }
  };

  const listRef = useCallback((node: HTMLDivElement | null) => {
    list.current = node;
    if (!node) return;
    const returnToInput = (event: globalThis.KeyboardEvent) => {
      const first = node.querySelector(ROW_SELECTOR);
      if (event.key !== 'ArrowUp' || document.activeElement !== first) return;
      event.preventDefault();
      event.stopPropagation();
      inputRef.current?.focus();
    };
    node.addEventListener('keydown', returnToInput, { capture: true });
    return () => node.removeEventListener('keydown', returnToInput, { capture: true });
  }, []);

  return { inputRef, listRef, onInputKeyDown };
}
