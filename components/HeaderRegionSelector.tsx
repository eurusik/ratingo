'use client';

import { useFilters } from './FiltersProvider';

export function HeaderRegionSelector() {
  const { region, setRegion } = useFilters();
  const current = region || 'US';
  const options = [
    { code: 'US', label: 'US', flag: '🇺🇸', title: 'Глобальний (US)' },
    { code: 'UA', label: 'UA', flag: '🇺🇦', title: 'Україна (UA)' },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-sm text-gray-400">Регіон:</span>
      <div
        role="group"
        aria-label="Вибір регіону"
        className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1"
      >
        {options.map((opt) => {
          const active = current === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              title={opt.title}
              aria-pressed={active}
              onClick={() => setRegion(opt.code)}
              className={
                (active
                  ? 'bg-zinc-800 text-white ring-1 ring-blue-500 '
                  : 'text-gray-300 hover:bg-zinc-800/50 hover:text-white ') +
                'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1 min-w-[60px] justify-center'
              }
            >
              <span aria-hidden>{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}