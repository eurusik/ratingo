'use client';

import { ArrowDownUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { MeListSort } from '../hooks/use-me-lists';

const VALID_SORTS: MeListSort[] = ['recent', 'rating', 'releaseDate'];

/**
 * Determines whether a string is a valid list sort key.
 *
 * @param v - Candidate sort key.
 * @returns `true` if `v` is one of the permitted sort values (`MeListSort`), `false` otherwise.
 */
function isMeListSort(v: string): v is MeListSort {
  return (VALID_SORTS as string[]).includes(v);
}

interface ListSortSelectProps {
  value: MeListSort;
  onChange: (value: MeListSort) => void;
}

/**
 * Renders a sort selection dropdown for saved lists using translated labels.
 *
 * @param value - Currently selected sort key ('recent', 'rating', or 'releaseDate')
 * @param onChange - Called with the new sort key when the user selects a valid option
 * @returns The Select React element configured for choosing list sort order
 */
export function ListSortSelect({ value, onChange }: ListSortSelectProps) {
  const { dict } = useTranslation();

  return (
    <Select value={value} onValueChange={(v) => { if (isMeListSort(v)) onChange(v); }}>
      <SelectTrigger className="w-[180px] h-9 bg-cinema-card/50 border-white/10 text-sm" aria-label={dict.activity?.sort?.label ?? 'Сортування'}>
        <ArrowDownUp className="w-4 h-4 mr-2 text-gray-400" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="recent">
          {dict.activity?.sort?.recent ?? 'Нещодавні'}
        </SelectItem>
        <SelectItem value="rating">
          {dict.activity?.sort?.rating ?? 'За оцінкою'}
        </SelectItem>
        <SelectItem value="releaseDate">
          {dict.activity?.sort?.releaseDate ?? 'За датою виходу'}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}