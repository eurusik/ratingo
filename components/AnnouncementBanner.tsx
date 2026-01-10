'use client';

import { useState, useEffect } from 'react';
import { X, Rocket } from 'lucide-react';

const STORAGE_KEY = 'ratingo-banner-dismissed-v2';

export function AnnouncementBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check localStorage only on client
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-center gap-x-2 sm:gap-x-3 text-sm pr-6">
          <Rocket className="w-4 h-4 flex-shrink-0 hidden sm:block" />
          <p className="font-medium">
            <span className="font-semibold">Ratingo 2.0</span>
            <span className="hidden sm:inline"> — оновлений досвід вибору фільмів і серіалів</span>
          </p>
          <span className="hidden sm:inline text-white/70 text-xs">Рання версія</span>
          <a
            href="https://new.ratingo.top/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-semibold transition-colors"
          >
            Спробувати
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="https://new.ratingo.top/"
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden text-white/90 hover:text-white text-xs font-medium underline underline-offset-2"
          >
            Спробувати →
          </a>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Закрити банер"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
