import React from "react";
import type { ShowWithUrl } from "@/lib/types";

type Region = string | null;

type DeltaMetric = "delta" | "delta3m";

function DeltaRow({ s, metric, region }: { s: ShowWithUrl; metric: DeltaMetric; region?: Region }) {
  const href = `/show/${s.id}${region ? `?region=${region}` : ""}`;
  const use3m = metric === "delta3m";
  const v = Number(use3m ? s.delta3m || 0 : s.watchersDelta || 0);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const denom = Number(s.ratingTrakt || 0);
  const pct = !use3m && denom > 0 ? ` (${((Math.abs(v) / denom) * 100).toFixed(1)}%)` : "";
  const label = `Δ ${use3m ? "3міс " : ""}${sign}${Math.abs(Math.round(v))} глядачів${pct}`;
  const displayTitle = s.title && s.titleUk && s.titleUk !== s.title
    ? `${s.title} / ${s.titleUk}`
    : (s.titleUk || s.title);

  return (
    <a href={href} className="flex items-center gap-3 bg-zinc-900 rounded-lg p-3 hover:bg-zinc-800 transition">
      {s.posterUrl && <img src={s.posterUrl} alt={displayTitle} className="w-10 h-15 object-cover rounded" />}
      <div className="flex-1">
        <div className="text-white text-sm font-semibold truncate">{displayTitle}</div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{label}</span>
          {use3m ? (
            (() => {
              const color = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#71717a";
              const points = v > 0 ? "0,12 40,12 80,6" : v < 0 ? "0,6 40,12 80,12" : "0,12 80,12";
              return (
                <svg width="80" height="16" viewBox="0 0 80 16">
                  <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
                </svg>
              );
            })()
          ) : (
            <div className="h-1 bg-zinc-700 rounded w-32">
              <div
                className={`h-1 rounded ${v > 0 ? "bg-green-500" : v < 0 ? "bg-red-500" : "bg-zinc-600"}`}
                style={{ width: `${Math.min(100, Math.abs(v))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

export function TrendingDeltaSection({
  gainers,
  losers,
  windowDays,
  metric,
  onChangeWindowDays,
  onChangeMetric,
  region,
  category,
}: {
  gainers: ShowWithUrl[];
  losers: ShowWithUrl[];
  windowDays: number;
  metric: DeltaMetric;
  onChangeWindowDays: (d: number) => void;
  onChangeMetric: (m: DeltaMetric) => void;
  region?: Region;
  category?: string | null;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
      <h2 className="text-2xl font-bold text-white mb-2">Злети і падіння</h2>
      <div className="flex items-center gap-3 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Вікно:</span>
          <button
            className={`px-2 py-1 rounded ${windowDays === 30 ? "bg-zinc-800 text-white" : "bg-zinc-900 text-gray-400"}`}
            title="Показати за 30 днів"
            onClick={() => onChangeWindowDays(30)}
          >
            30 днів
          </button>
          <button
            className={`px-2 py-1 rounded ${windowDays === 90 ? "bg-zinc-800 text-white" : "bg-zinc-900 text-gray-400"}`}
            title="Показати за 90 днів"
            onClick={() => onChangeWindowDays(90)}
          >
            90 днів
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Метрика:</span>
          <button
            className={`px-2 py-1 rounded ${metric === "delta" ? "bg-zinc-800 text-white" : "bg-zinc-900 text-gray-400"}`}
            title="Зміна глядачів між останніми знімками бази"
            onClick={() => onChangeMetric("delta")}
          >
            Δ
          </button>
          <button
            className={`px-2 py-1 rounded ${metric === "delta3m" ? "bg-zinc-800 text-white" : "bg-zinc-900 text-gray-400"}`}
            title="Зміна за три календарні місяці (місячні чарти)"
            onClick={() => onChangeMetric("delta3m")}
          >
            Δ 3міс
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Вікно: {windowDays} днів • Метрика: {metric === "delta" ? "Δ (останні знімки бази)" : "Δ 3міс (місячні чарти)"}
        {region ? ` • Регіон: ${region === "US" ? "Глобальний" : region}` : ""}
        {category ? ` • Категорія: ${category}` : ""}
      </div>
      <div className="text-xs text-gray-400 bg-zinc-900/60 border border-zinc-800 rounded p-3 mb-4">
        <div className="font-semibold text-white mb-1">ℹ️ Що означають метрики</div>
        <div className="mb-1">Δ — залежить від «Вікна»: різниця глядачів між найпершим і найсвіжішим знімком у межах вибраних {windowDays} днів. Якщо знімків бракує, показуємо різницю між двома останніми глобальними знімками бази.</div>
        <div>Δ 3міс — зміна за три календарні місяці, розрахована на основі місячних чартів Trakt. Краще відображає стабільні тренди.</div>
      </div>
      {(gainers.length === 0 && losers.length === 0) && (
        <div className="text-xs text-gray-400 bg-zinc-900/60 border border-zinc-800 rounded p-3 mb-4">
          <div className="font-semibold text-white mb-1">Немає змін у цьому вікні</div>
          <div className="mb-2">У вибраному вікні ({windowDays} днів) не зафіксовано суттєвих «злетів» або «падінь». Спробуйте місячну метрику.</div>
          <button
            className="px-2 py-1 rounded bg-zinc-800 text-white hover:bg-zinc-700"
            onClick={() => onChangeMetric("delta3m")}
            title="Перемкнути на Δ 3міс"
          >
            Перемкнути на Δ 3міс
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg text-green-400 mb-2">Злети</h3>
          <div className="space-y-3">
            {gainers.map((s) => (
              <DeltaRow key={s.id} s={s} metric={metric} region={region} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg text-red-400 mb-2">Падіння</h3>
          <div className="space-y-3">
            {losers.map((s) => (
              <DeltaRow key={s.id} s={s} metric={metric} region={region} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}