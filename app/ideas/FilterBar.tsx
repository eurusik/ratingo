'use client';
import { useState } from 'react';

export default function FilterBar({
  sortBy,
  onSortChange,
  allTags,
  activeTag,
  setActiveTag,
}: {
  sortBy: 'votes' | 'recent';
  onSortChange: (s: 'votes' | 'recent') => void;
  allTags: string[];
  activeTag: string | null;
  setActiveTag: (t: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = 8;
  const extra = allTags.length > max ? allTags.length - max : 0;
  const visible = expanded ? allTags : allTags.slice(0, max);
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-lg bg-zinc-800 p-1">
        <button
          className={`px-3 py-1 rounded-md text-sm ${sortBy === 'votes' ? 'bg-zinc-700 text-white' : 'text-gray-300 hover:text-white'}`}
          onClick={() => onSortChange('votes')}
        >
          За голосами
        </button>
        <button
          className={`px-3 py-1 rounded-md text-sm ${sortBy === 'recent' ? 'bg-zinc-700 text-white' : 'text-gray-300 hover:text-white'}`}
          onClick={() => onSortChange('recent')}
        >
          Нещодавні
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {visible.map((t) => (
          <button
            key={t}
            className={`text-xs px-2 py-1 rounded ${activeTag === t ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'}`}
            onClick={() => setActiveTag(activeTag === t ? null : t)}
          >
            {t}
          </button>
        ))}
        {!expanded && extra > 0 ? (
          <button
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-gray-300 hover:bg-zinc-700"
            onClick={() => setExpanded(true)}
          >
            Інші (+{extra})
          </button>
        ) : null}
        {expanded && extra > 0 ? (
          <button
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-gray-300 hover:bg-zinc-700"
            onClick={() => setExpanded(false)}
          >
            Згорнути
          </button>
        ) : null}
      </div>
    </div>
  );
}
