'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type FiltersContextValue = {
  region: string | null;
  category: string | null;
  setRegion: (region: string | null) => void;
  setCategory: (category: string | null) => void;
};

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const spRegion = searchParams.get('region');
  const spCategory = searchParams.get('category');

  const [region, setRegionState] = useState<string | null>(spRegion || null);
  const [category, setCategoryState] = useState<string | null>(spCategory || null);

  useEffect(() => {
    // Initialize from localStorage if URL lacks values
    if (typeof window !== 'undefined') {
      const lsRegion = window.localStorage.getItem('region') || undefined;
      const lsCategory = window.localStorage.getItem('category') || undefined;
      const nextRegion = spRegion || lsRegion || 'US'; // default to US
      const nextCategory = spCategory || lsCategory || '' || null;
      setRegionState(nextRegion);
      setCategoryState(nextCategory === '' ? null : nextCategory);
      // Ensure URL reflects initial values for consistency
      const params = new URLSearchParams(searchParams.toString());
      if (nextRegion) params.set('region', nextRegion);
      else params.delete('region');
      if (nextCategory) params.set('category', nextCategory);
      else params.delete('category');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, []);

  const updateUrl = (nextRegion: string | null, nextCategory: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextRegion) params.set('region', nextRegion);
    else params.delete('region');
    if (nextCategory) params.set('category', nextCategory);
    else params.delete('category');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setRegion = (value: string | null) => {
    const next = value || 'US';
    setRegionState(next);
    updateUrl(next, category);
    if (typeof window !== 'undefined') window.localStorage.setItem('region', next);
  };

  const setCategory = (value: string | null) => {
    const next = value && value.length > 0 ? value : null;
    setCategoryState(next);
    updateUrl(region, next);
    if (typeof window !== 'undefined') window.localStorage.setItem('category', next || '');
  };

  const value = useMemo<FiltersContextValue>(
    () => ({ region, category, setRegion, setCategory }),
    [region, category]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
