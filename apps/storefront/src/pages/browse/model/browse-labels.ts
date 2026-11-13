import type { MediaType } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import type { ScoreThreshold } from './browse-state';
import type { FilterRemoval } from './filter-removals';
import type { GenreSlug } from './genres';
import { matchYearPreset, type YearPreset, type YearRange } from './year-presets';

const CENTURY = 100;
const GROUP_SEPARATOR = /\s/g;
const NO_BREAK_SPACE = ' ';

const pluralRules = new Map<Locale, Intl.PluralRules>();
const countFormats = new Map<Locale, Intl.NumberFormat>();

function cached<T>(cache: Map<Locale, T>, locale: Locale, create: () => T): T {
  const existing = cache.get(locale);
  if (existing) return existing;
  const created = create();
  cache.set(locale, created);
  return created;
}

function formatCount(locale: Locale, count: number): string {
  const format = cached(countFormats, locale, () => new Intl.NumberFormat(locale));
  return format.format(count).replace(GROUP_SEPARATOR, NO_BREAK_SPACE);
}

export function countLabel(dict: Dictionary, locale: Locale, type: MediaType, count: number) {
  const forms = dict.browse.count[type];
  const category = cached(pluralRules, locale, () => new Intl.PluralRules(locale)).select(count);
  const form = category === 'zero' || category === 'two' ? forms.other : forms[category];
  return interpolate(form, { count: formatCount(locale, count) });
}

export function useCountLabel(type: MediaType): (count: number) => string {
  const { dict, locale } = useTranslation();
  return (count) => countLabel(dict, locale, type, count);
}

export function genreLabel(dict: Dictionary, slug: GenreSlug): string {
  return dict.browse.genres[slug];
}

export function yearPresetLabel(dict: Dictionary, preset: YearPreset): string {
  const { filters } = dict.browse;
  if (preset.id === 'older') return filters.older;
  if (preset.id === 'current' || preset.id === 'previous') return String(preset.yearFrom);
  const template = preset.yearFrom % CENTURY === 0 ? filters.decadeMillennium : filters.decade;
  return interpolate(template, { decade: preset.yearFrom });
}

export function yearRangeLabel(
  dict: Dictionary,
  presets: readonly YearPreset[],
  range: YearRange,
): string {
  const preset = matchYearPreset(presets, range);
  if (preset) return yearPresetLabel(dict, preset);
  return interpolate(dict.browse.filters.range, {
    from: range.yearFrom ?? '',
    to: range.yearTo ?? '',
  });
}

function scoreLabel(dict: Dictionary, score: ScoreThreshold): string {
  return interpolate(dict.browse.filters.scoreFrom, { score });
}

export function removalLabel(
  dict: Dictionary,
  presets: readonly YearPreset[],
  removal: FilterRemoval,
): string {
  if (removal.kind === 'genre') return genreLabel(dict, removal.genre);
  if (removal.kind === 'year') return yearRangeLabel(dict, presets, removal.range);
  return scoreLabel(dict, removal.score);
}
