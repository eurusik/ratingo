'use client';

import { useId, type ReactNode } from 'react';

export function TrackingCard({ children }: { children: (headingId: string) => ReactNode }) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-3xl bg-surface/45 p-4 backdrop-blur-xl"
    >
      {children(headingId)}
    </section>
  );
}
