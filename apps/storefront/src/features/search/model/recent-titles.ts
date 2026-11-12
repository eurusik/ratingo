'use client';

import { useSyncExternalStore } from 'react';
import type { SearchTitle } from './search-title';

const STORAGE_KEY = 'ratingo:recent-titles:v1';
const MAX_RECENT_TITLES = 8;
const EMPTY: readonly SearchTitle[] = [];

let cached: readonly SearchTitle[] | null = null;
const listeners = new Set<() => void>();

function isSearchTitle(value: unknown): value is SearchTitle {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SearchTitle>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.slug === 'string' &&
    (candidate.type === 'movie' || candidate.type === 'show')
  );
}

export function parseRecentTitles(raw: string | null): readonly SearchTitle[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSearchTitle).slice(0, MAX_RECENT_TITLES) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persist(titles: readonly SearchTitle[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

function readRecentTitles(): readonly SearchTitle[] {
  cached ??= parseRecentTitles(readStorage());
  return cached;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function reloadOnOwnKey(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  cached = null;
  notify();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', reloadOnOwnKey);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', reloadOnOwnKey);
  };
}

const readServerTitles = () => EMPTY;

export function useRecentTitles(): readonly SearchTitle[] {
  return useSyncExternalStore(subscribe, readRecentTitles, readServerTitles);
}

function writeRecentTitles(titles: readonly SearchTitle[]): void {
  cached = titles;
  persist(titles);
  notify();
}

function sameTitle(a: SearchTitle, b: SearchTitle): boolean {
  return a.type === b.type && a.slug === b.slug;
}

function toStoredTitle({ type, slug, title, year, posterUrl, rating }: SearchTitle): SearchTitle {
  return {
    key: `recent-${type}-${slug}`,
    isInCatalog: true,
    type,
    slug,
    title,
    year,
    posterUrl,
    rating,
  };
}

export function withRecentTitle(titles: readonly SearchTitle[], title: SearchTitle): SearchTitle[] {
  return [title, ...titles.filter((existing) => !sameTitle(existing, title))].slice(
    0,
    MAX_RECENT_TITLES,
  );
}

export function rememberTitle(title: SearchTitle): void {
  writeRecentTitles(withRecentTitle(readRecentTitles(), toStoredTitle(title)));
}

export function forgetTitle(title: SearchTitle): void {
  writeRecentTitles(readRecentTitles().filter((existing) => !sameTitle(existing, title)));
}

export function clearRecentTitles(): void {
  writeRecentTitles(EMPTY);
}
