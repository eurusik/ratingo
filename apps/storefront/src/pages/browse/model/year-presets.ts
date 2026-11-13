type YearPresetId = 'current' | 'previous' | 'decade' | 'olderDecade' | 'oldestDecade' | 'older';

export interface YearRange {
  yearFrom?: number;
  yearTo?: number;
}

export interface YearPreset extends YearRange {
  id: YearPresetId;
}

const DECADE = 10;

export function yearPresets(currentYear: number): YearPreset[] {
  const decade = currentYear - (currentYear % DECADE);
  const decadeRange = (start: number) => ({ yearFrom: start, yearTo: start + DECADE - 1 });

  return [
    { id: 'current', yearFrom: currentYear, yearTo: currentYear },
    { id: 'previous', yearFrom: currentYear - 1, yearTo: currentYear - 1 },
    { id: 'decade', ...decadeRange(decade) },
    { id: 'olderDecade', ...decadeRange(decade - DECADE) },
    { id: 'oldestDecade', ...decadeRange(decade - 2 * DECADE) },
    { id: 'older', yearTo: decade - 2 * DECADE - 1 },
  ];
}

export function matchYearPreset(presets: readonly YearPreset[], range: YearRange) {
  return presets.find(
    (preset) => preset.yearFrom === range.yearFrom && preset.yearTo === range.yearTo,
  );
}

export function hasYearRange(range: YearRange): boolean {
  return range.yearFrom !== undefined || range.yearTo !== undefined;
}
