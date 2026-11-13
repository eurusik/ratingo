'use client';

import { useId } from 'react';
import { Description, Label, Tag, TagGroup, type Selection } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { SegmentedFilter } from '@/shared/ui';
import { SCORE_THRESHOLDS, type BrowseFilters, type ScoreThreshold } from '../model/browse-state';
import { genreLabel, yearPresetLabel } from '../model/browse-labels';
import { GENRE_SLUGS, isGenreOf, type GenreSlug } from '../model/genres';
import {
  hasYearRange,
  matchYearPreset,
  type YearPreset,
  type YearRange,
} from '../model/year-presets';

const ANY = 'any';
const TAG_CLASS = 'min-h-10 px-3.5';

type ScoreOption = typeof ANY | `${ScoreThreshold}`;

function selectedKeys(selection: Selection): string[] {
  return selection === 'all' ? [] : [...selection].map(String);
}

interface GenreFieldProps {
  type: MediaType;
  value: readonly GenreSlug[];
  onChange: (genres: GenreSlug[]) => void;
}

function GenreField({ type, value, onChange }: GenreFieldProps) {
  const { dict } = useTranslation();

  return (
    <TagGroup
      selectionMode="multiple"
      selectedKeys={value}
      onSelectionChange={(selection) =>
        onChange(selectedKeys(selection).filter((slug) => isGenreOf(type, slug)))
      }
      className="flex flex-col gap-2.5"
    >
      <Label>{dict.browse.filters.genres}</Label>
      <Description>{dict.browse.filters.genresHint}</Description>
      <TagGroup.List className="flex flex-wrap gap-2">
        {GENRE_SLUGS[type].map((slug) => (
          <Tag key={slug} id={slug} className={TAG_CLASS}>
            {genreLabel(dict, slug)}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}

interface YearFieldProps {
  presets: readonly YearPreset[];
  value: YearRange;
  onChange: (range: YearRange) => void;
}

function YearField({ presets, value, onChange }: YearFieldProps) {
  const { dict } = useTranslation();

  const matched = matchYearPreset(presets, value)?.id;
  const customRangeKeys = hasYearRange(value) ? [] : [ANY];
  const selectedYearKeys = matched ? [matched] : customRangeKeys;

  const pick = (selection: Selection) => {
    const [id] = selectedKeys(selection);
    const preset = presets.find((candidate) => candidate.id === id);
    onChange({ yearFrom: preset?.yearFrom, yearTo: preset?.yearTo });
  };

  return (
    <TagGroup
      selectionMode="single"
      selectedKeys={selectedYearKeys}
      onSelectionChange={pick}
      className="flex flex-col gap-2.5"
    >
      <Label>{dict.browse.filters.year}</Label>
      <TagGroup.List className="flex flex-wrap gap-2">
        <Tag id={ANY} className={TAG_CLASS}>
          {dict.browse.filters.yearAny}
        </Tag>
        {presets.map((preset) => (
          <Tag key={preset.id} id={preset.id} className={TAG_CLASS}>
            {yearPresetLabel(dict, preset)}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}

interface ScoreFieldProps {
  value: ScoreThreshold | undefined;
  onChange: (minScore: ScoreThreshold | undefined) => void;
}

function ScoreField({ value, onChange }: ScoreFieldProps) {
  const { dict } = useTranslation();
  const hintId = useId();
  const labels = dict.browse.filters;
  const options: { id: ScoreOption; label: string }[] = [
    { id: ANY, label: labels.scoreAny },
    ...SCORE_THRESHOLDS.map((score) => ({ id: `${score}` as const, label: `${score}+` })),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{labels.score}</span>
        <p id={hintId} className="text-xs text-muted">
          {labels.scoreHint[value ?? ANY]}
        </p>
      </div>
      <SegmentedFilter<ScoreOption>
        label={labels.score}
        options={options}
        value={value === undefined ? ANY : `${value}`}
        onChange={(option) => onChange(SCORE_THRESHOLDS.find((score) => `${score}` === option))}
        descriptionId={hintId}
        className="px-0"
      />
    </div>
  );
}

interface FilterFieldsProps {
  type: MediaType;
  filters: BrowseFilters;
  yearPresets: readonly YearPreset[];
  onChange: (next: BrowseFilters) => void;
}

export function FilterFields({ type, filters, yearPresets, onChange }: FilterFieldsProps) {
  return (
    <div className="flex flex-col gap-6">
      <GenreField
        type={type}
        value={filters.genres}
        onChange={(genres) => onChange({ ...filters, genres })}
      />
      <YearField
        presets={yearPresets}
        value={filters}
        onChange={(range) => onChange({ ...filters, ...range })}
      />
      <ScoreField
        value={filters.minScore}
        onChange={(minScore) => onChange({ ...filters, minScore })}
      />
    </div>
  );
}
