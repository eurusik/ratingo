import type { ReactNode } from 'react';

interface SpikeSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function SpikeSection({ id, title, children }: SpikeSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
