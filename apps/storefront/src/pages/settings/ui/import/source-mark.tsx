import { cn } from '@ratingo/web-core/lib';
import type { ListedSource } from '@/pages/settings/model/import/import-sources';

const MARKS: Record<ListedSource, { glyph: string; className: string }> = {
  kinobaza: { glyph: 'К', className: 'bg-zinc-700 text-white text-xl' },
  imdb: { glyph: 'IMDb', className: 'bg-[#f5c518] text-black text-sm' },
  tmdb: { glyph: 'TMDB', className: 'bg-[#0d253f] text-[#01b4e4] text-xs' },
  letterboxd: { glyph: '•••', className: 'bg-[#202830] text-[#00e054] text-sm' },
};

export function SourceMark({ source, className }: { source: ListedSource; className?: string }) {
  const mark = MARKS[source];
  return (
    <span
      aria-hidden
      translate="no"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl font-black tracking-tight',
        mark.className,
        className,
      )}
    >
      {mark.glyph}
    </span>
  );
}
