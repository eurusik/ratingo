'use client';
import { useState } from 'react';
import FilterBar from './FilterBar';
import IdeaItem from './IdeaItem';
import RequestModal from './RequestModal';

type FeatureItem = {
  id: number;
  title: string;
  brief: string | null;
  description: string | null;
  tags: string[] | null;
  status: string;
  votes: number;
  createdAt: string;
};

export default function IdeasClient({ initialItems }: { initialItems: FeatureItem[] }) {
  const [items, setItems] = useState<FeatureItem[]>(initialItems || []);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [voteFx, setVoteFx] = useState<Record<number, boolean>>({});
  const [plusOne, setPlusOne] = useState<Record<number, boolean>>({});
  const [sortPaused, setSortPaused] = useState<boolean>(false);

  function InlineProgress({
    value,
    max,
    invalid,
  }: {
    value: number;
    max: number;
    invalid?: boolean;
  }) {
    const pct = Math.min(100, Math.floor((value / max) * 100));
    const barClass = invalid ? 'from-red-500 to-red-400' : 'from-blue-500 to-purple-500';
    return (
      <div className="mt-1 h-1 w-24 sm:w-28 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-1 rounded-full bg-gradient-to-r ${barClass} transition-[width] duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  async function vote(id: number) {
    if (voted[id]) return;
    try {
      const res = await fetch('/api/ideas/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        let msg = 'Помилка голосування';
        try {
          const j = await res.json();
          if (typeof j?.error === 'string') msg = j.error;
        } catch {}
        if (res.status === 429) setVoted((prev) => ({ ...prev, [id]: true }));
        setError(msg);
        return;
      }
      const { item } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, votes: item.votes } : it)));
      setVoted((prev) => ({ ...prev, [id]: true }));
      setVoteFx((prev) => ({ ...prev, [id]: true }));
      setPlusOne((prev) => ({ ...prev, [id]: true }));
      setSortPaused(true);
      setTimeout(() => {
        setVoteFx((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }, 600);
      setTimeout(() => {
        setPlusOne((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }, 600);
      setTimeout(() => setSortPaused(false), 650);
    } catch {
      setError('Помилка голосування');
    }
  }

  const allTags = Array.from(
    new Set((items || []).flatMap((it) => (Array.isArray(it.tags) ? it.tags : [])))
  ).slice(0, 12);

  const visibleItems = (() => {
    let arr = [...items];
    if (activeTag) arr = arr.filter((it) => Array.isArray(it.tags) && it.tags.includes(activeTag!));
    if (!sortPaused) {
      if (sortBy === 'votes') arr.sort((a, b) => (b.votes || 0) - (a.votes || 0));
      else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
  })();

  async function fetchPage(reset: boolean) {
    try {
      setLoadingMore(true);
      const limit = 20;
      const offset = reset ? 0 : items.length;
      const res = await fetch(`/api/ideas/features?limit=${limit}&offset=${offset}&sort=${sortBy}`);
      if (!res.ok) return;
      const data = await res.json();
      const newItems = Array.isArray(data?.items) ? data.items : [];
      setHasMore(Boolean(data?.hasMore));
      setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
    } finally {
      setLoadingMore(false);
    }
  }

  function loadMore() {
    fetchPage(false);
  }

  function onSortChange(next: 'votes' | 'recent') {
    setSortBy(next);
    setItems([]);
    fetchPage(true);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-gray-400">
            Голосуйте за фічі, які хочете бачити. Гості можуть голосувати та пропонувати нові фічі.
          </p>
          <button
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            onClick={() => setOpen(true)}
          >
            Запропонувати фічу
          </button>
        </div>
        <FilterBar
          sortBy={sortBy}
          onSortChange={onSortChange}
          allTags={allTags}
          activeTag={activeTag}
          setActiveTag={setActiveTag}
        />
      </div>

      {error && !open ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {success && !open ? <p className="mb-3 text-sm text-green-400">{success}</p> : null}
      <ul className="space-y-3">
        {visibleItems.map((it) => (
          <IdeaItem key={it.id} item={it} voted={!!voted[it.id]} onVote={vote} />
        ))}
        {items.length === 0 ? (
          <li className="text-gray-400">Поки що немає запитів — стань першим!</li>
        ) : null}
      </ul>
      <div className="mt-4 flex justify-center">
        {hasMore ? (
          <button
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-60"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Завантаження…' : 'Показати ще'}
          </button>
        ) : null}
      </div>

      <RequestModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(item) => {
          setItems((prev) => [item, ...prev]);
          setSuccess('Запит створено');
        }}
        onError={(msg) => setError(msg)}
      />
      <div className="fixed bottom-4 right-4 space-y-2 pointer-events-none">
        {success && !open ? (
          <div className="pointer-events-auto rounded-lg bg-zinc-800 text-green-300 px-3 py-2 shadow-lg">
            {success}
          </div>
        ) : null}
        {error && !open ? (
          <div className="pointer-events-auto rounded-lg bg-zinc-800 text-red-300 px-3 py-2 shadow-lg">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
