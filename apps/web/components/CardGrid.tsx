import React from 'react';

interface CardGridProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function CardGrid({ children, title, className = '' }: CardGridProps) {
  return (
    <section className={`py-8 ${className}`}>
      {title && <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        {children}
      </div>
    </section>
  );
}
