'use client';

import { useFilters } from './FiltersProvider';

export function TopFilterBar() {
  const { region, setRegion } = useFilters();

  return (
    <div className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Регіон:</span>
          <select
            value={region || 'US'}
            onChange={(e) => setRegion(e.target.value)}
            className="bg-zinc-900 text-gray-300 border border-zinc-700 rounded px-2 py-1"
            title="Фільтрувати за регіоном провайдерів"
          >
            <option value="US">Глобальний (US)</option>
            <option value="UA">Україна (UA)</option>
          </select>
        </div>
        {/* Категорію прибрано за вимогою дизайну */}
      </div>
    </div>
  );
}
