'use client';

import { useEffect, useState } from 'react';
import {
  formatNavigationLog,
  recordNavigation,
  type NavigationLogEntry,
} from './navigation-recorder';

export function NavigationDebugPanel() {
  const [entries, setEntries] = useState<NavigationLogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [clearedAt, setClearedAt] = useState(0);

  useEffect(() => recordNavigation(setEntries), []);

  const visibleEntries = entries.filter((entry) => entry.at > clearedAt);
  const log = formatNavigationLog(visibleEntries);

  return (
    <div className="fixed top-[calc(var(--safe-top)+0.25rem)] right-2 z-50 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-1 font-mono text-[10px] [view-transition-name:navigation-debug]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-md bg-black/80 px-2 py-1 text-white ring-1 ring-white/30"
      >
        nav {visibleEntries.length}
      </button>
      {isOpen ? (
        <div className="flex w-[min(24rem,calc(100vw-1rem))] flex-col gap-1 rounded-md bg-black/90 p-2 text-white ring-1 ring-white/30">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(log)}
              className="rounded bg-white/15 px-2 py-0.5"
            >
              copy
            </button>
            <button
              type="button"
              onClick={() => setClearedAt(performance.now())}
              className="rounded bg-white/15 px-2 py-0.5"
            >
              clear
            </button>
          </div>
          <pre className="max-h-[60vh] overflow-auto break-all whitespace-pre-wrap">{log}</pre>
        </div>
      ) : null}
    </div>
  );
}
