/**
 * Interactive Quick Pitch with smooth scroll to overview.
 */

'use client';

import { ChevronDown } from 'lucide-react';

interface QuickPitchScrollProps {
  text: string;
}

export function QuickPitchScroll({ text }: QuickPitchScrollProps) {
  const handleClick = () => {
    const overviewSection = document.getElementById('overview-section');
    if (overviewSection) {
      overviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-left text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl hover:text-zinc-100 transition-colors cursor-pointer group"
    >
      <span className="group-hover:opacity-80 transition-opacity">
        {text}
      </span>
      <span className="inline-block ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500">
        <ChevronDown className="w-4 h-4 inline" />
      </span>
    </button>
  );
}
