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
 * Картка фічі з анімацією голосування.
 * Показує заголовок, короткий опис, теги (з лімітом до 5 + "+N"), дату створення.
 * При голосі запускає коротку анімацію кнопки та індикатор "+1".
 * Можна розгорнути для перегляду повного опису.
 */
export default function IdeaItem({
  item,
  voted,
  onVote,
}: {
  item: FeatureItem;
  voted: boolean;
  onVote: (id: number) => Promise<void>;
}) {
  const [fx, setFx] = useState(false);
  const [plusOne, setPlusOne] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleVote() {
    if (voted) return;
    await onVote(item.id);
    setFx(true);
    setPlusOne(true);
    setTimeout(() => setFx(false), 600);
    setTimeout(() => setPlusOne(false), 600);
  }

  const hasDescription = item.description && item.description !== item.brief;

  return (
    <li className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <div>
          <h3 className="text-white font-semibold text-lg">{item.title}</h3>
          {item.brief ? <p className="text-sm text-gray-400 mt-1">{item.brief}</p> : null}
          {expanded && hasDescription ? (
            <div className="mt-2 text-sm text-gray-300 whitespace-pre-wrap border-l-2 border-blue-500 pl-3 py-1">
              {item.description}
            </div>
          ) : null}
          {hasDescription ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {expanded ? '▼ Згорнути' : '▶ Показати деталі'}
            </button>
          ) : null}
          {item.tags && item.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.slice(0, 5).map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded bg-zinc-800 text-gray-300">
                  {t}
                </span>
              ))}
              {item.tags.length > 5 ? (
                <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-gray-400">
                  +{item.tags.length - 5}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative flex flex-col items-end">
          {plusOne ? (
            <span className="absolute -top-3 right-0 text-green-400 text-xs animate-bounce">
              +1
            </span>
          ) : null}
          <button
            className={`px-3 py-1 rounded text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-transform duration-200 ${fx ? 'bg-blue-600 scale-110' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            onClick={handleVote}
            disabled={voted}
          >
            ▲ {item.votes}
          </button>
          <span className="mt-1 text-xs text-gray-500">
            {new Date(item.createdAt).toLocaleDateString('uk-UA')}
          </span>
        </div>
      </div>
    </li>
  );
}
