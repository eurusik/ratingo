import type { MediaType } from '@/shared/api';
import { interpolate, type Dictionary, type Locale } from '@/shared/i18n';
import type { BrowseFilters, ScoreThreshold } from './browse-state';
import type { FilterRemoval } from './filter-removals';
import type { GenreSlug } from './genres';
import { matchYearPreset, type YearPreset, type YearRange } from './year-presets';

const CENTURY = 100;
const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

export function countLabel(dict: Dictionary, locale: Locale, type: MediaType, count: number) {
  const forms = dict.browse.count[type];
  const category = pluralCategory(locale, count);
  const form = category === 'zero' || category === 'two' ? forms.other : forms[category];
  return interpolate(form, { count: count.toLocaleString(locale) });
}

export function genreLabel(dict: Dictionary, slug: GenreSlug): string {
  return dict.browse.genres[slug];
}

export function yearPresetLabel(dict: Dictionary, preset: YearPreset): string {
  const { filters } = dict.browse;
  if (preset.id === 'older') return filters.older;
  if (preset.id === 'current' || preset.id === 'previous') return String(preset.yearFrom);
  const decade = preset.yearFrom ?? 0;
  const template = decade % CENTURY === 0 ? filters.decadeMillennium : filters.decade;
  return interpolate(template, { decade });
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
  filters: BrowseFilters,
  removal: FilterRemoval,
): string {
  if (removal.kind === 'genre') return genreLabel(dict, removal.genre);
  if (removal.kind === 'year') return yearRangeLabel(dict, presets, filters);
  return filters.minScore === undefined ? '' : scoreLabel(dict, filters.minScore);
}
