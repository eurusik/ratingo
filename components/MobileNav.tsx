'use client';

import { useState } from 'react';
import { useFilters } from './FiltersProvider';
import { Flame, Clapperboard, Menu, X } from 'lucide-react';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { region, setRegion } = useFilters();

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors"
        aria-label="Menu"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div className="fixed top-16 right-0 left-0 bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800 z-50 shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
              {/* Navigation Links */}
              <a
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-all duration-300"
              >
                <Flame className="w-6 h-6 text-orange-500" />
                <span className="text-lg font-semibold text-white">Тренди</span>
              </a>

              <a
                href="/airings"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-all duration-300"
              >
                <Clapperboard className="w-6 h-6 text-purple-400" />
                <span className="text-lg font-semibold text-white">Надходження</span>
              </a>

              {/* Region Selector */}
              <div className="pt-4 border-t border-zinc-800">
                <div className="text-sm text-gray-400 mb-2">Регіон:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setRegion('US');
                      setIsOpen(false);
                    }}
                    className={`p-3 rounded-lg font-semibold transition-all duration-300 ${
                      region === 'US'
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : 'bg-zinc-800/50 text-gray-300 hover:bg-zinc-700/50'
                    }`}
                  >
                    🇺🇸 Глобальний
                  </button>
                  <button
                    onClick={() => {
                      setRegion('UA');
                      setIsOpen(false);
                    }}
                    className={`p-3 rounded-lg font-semibold transition-all duration-300 ${
                      region === 'UA'
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : 'bg-zinc-800/50 text-gray-300 hover:bg-zinc-700/50'
                    }`}
                  >
                    🇺🇦 Україна
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
