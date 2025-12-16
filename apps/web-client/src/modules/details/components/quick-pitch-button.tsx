/**
 * Interactive Quick Pitch button with smooth scroll to overview.
 * 
 * **UX Design:**
 * - Looks like regular text (not a link!)
 * - Subtle hover effect: lighter color + down arrow
 * - Smooth scroll to full overview section
 * - No underline or button-like appearance
 */

'use client';

interface QuickPitchButtonProps {
  text: string;
}

export function QuickPitchButton({ text }: QuickPitchButtonProps) {
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
        ↓
      </span>
    </button>
  );
}
