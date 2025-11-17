'use client';
import { useState } from 'react';

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

/**
 * Компактний анімований прогрес‑бар для лічильників символів.
 */
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

/**
 * Модальне вікно створення запиту фічі з валідацією, прогрес‑барами і тегами.
 */
export default function RequestModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (item: FeatureItem) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addTagFromInput() {
    const raw = tagsInput.trim();
    if (!raw) return;
    const base = raw.length > 24 ? raw.slice(0, 24) : raw;
    if (tagsList.includes(base)) {
      setTagsInput('');
      return;
    }
    if (tagsList.length >= 5) return;
    setTagsList((prev) => [...prev, base]);
    setTagsInput('');
  }

  function removeTag(tag: string) {
    setTagsList((prev) => prev.filter((t) => t !== tag));
  }

  async function submitFeature() {
    if (!title || title.trim().length < 3 || title.trim().length > 128) {
      onError('Недійсна назва');
      return;
    }
    if (brief && brief.length > 256) {
      onError('Занадто довгий короткий опис');
      return;
    }
    if (description && description.length > 2000) {
      onError('Занадто довгий опис');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ideas/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          brief: brief.trim(),
          description: description.trim(),
          tags: tagsList,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(j?.error || 'Помилка надсилання');
        return;
      }
      onCreated(j.item);
      onClose();
      setTitle('');
      setBrief('');
      setDescription('');
      setTagsInput('');
      setTagsList([]);
    } catch {
      onError('Помилка створення запиту');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center mt-20">
        <div className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Запропонувати фічу</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-300">Назва</label>
              <input
                className="mt-1 w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Сторінки акторів"
              />
              <div className="mt-1 flex justify-between text-xs">
                <span
                  className={`${title.trim().length > 128 || (title.trim().length > 0 && title.trim().length < 3) ? 'text-red-400' : 'text-gray-500'}`}
                >
                  {title.trim().length}/128
                </span>
                {title.trim().length > 0 && title.trim().length < 3 ? (
                  <span className="text-red-400">мінімум 3 символи</span>
                ) : null}
              </div>
              <InlineProgress
                value={title.trim().length}
                max={128}
                invalid={
                  title.trim().length > 128 || (title.trim().length > 0 && title.trim().length < 3)
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300">Короткий опис</label>
              <input
                className="mt-1 w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Додати сторінки акторів з їхніми фільмами та серіалами"
              />
              <div className="mt-1 flex justify-between text-xs">
                <span className={`${brief.length > 256 ? 'text-red-400' : 'text-gray-500'}`}>
                  {brief.length}/256
                </span>
              </div>
              <InlineProgress value={brief.length} max={256} invalid={brief.length > 256} />
            </div>
            <div>
              <label className="block text-sm text-gray-300">Опис</label>
              <textarea
                className="mt-1 w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Детальний опис того, що ви хотіли б бачити..."
              />
              <div className="mt-1 flex justify-between text-xs">
                <span className={`${description.length > 2000 ? 'text-red-400' : 'text-gray-500'}`}>
                  {description.length}/2000
                </span>
              </div>
              <InlineProgress
                value={description.length}
                max={2000}
                invalid={description.length > 2000}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300">Теги</label>
              <div className="flex gap-2">
                <input
                  className="mt-1 w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTagFromInput();
                    }
                  }}
                  placeholder="серіали, фільми"
                />
                <button
                  type="button"
                  className="mt-1 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-gray-200"
                  onClick={addTagFromInput}
                >
                  Додати
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Додайте теги (через кому або Enter). Залишилось: {Math.max(0, 5 - tagsList.length)}
              </p>
              {tagsList.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagsList.map((t) => (
                    <button
                      key={t}
                      className="group inline-flex items-center text-xs px-2 py-1 rounded bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                      onClick={() => removeTag(t)}
                    >
                      {t}
                      <span className="ml-1 text-gray-500 group-hover:text-gray-300">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex gap-3 justify-end">
            <button
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white"
              onClick={onClose}
            >
              Скасувати
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={submitFeature}
              disabled={
                loading ||
                !title.trim() ||
                title.trim().length < 3 ||
                title.trim().length > 128 ||
                brief.length > 256 ||
                description.length > 2000
              }
            >
              {loading ? 'Створення...' : 'Створити запит'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
