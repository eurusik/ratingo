import type { ReactNode } from 'react';

interface DetailsSectionProps {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
}

export function DetailsSection({ id, title, className, children }: DetailsSectionProps) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-2.5 md:gap-3 ${className ?? ''}`}>
      <h2 id={id} className="text-xl font-extrabold tracking-tight md:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
