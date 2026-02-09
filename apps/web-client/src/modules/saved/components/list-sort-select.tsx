'use client';

import { ArrowDownUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { MeListSort } from '../hooks/use-me-lists';

interface ListSortSelectProps {
  value: MeListSort;
  onChange: (value: MeListSort) => void;
}

export function ListSortSelect({ value, onChange }: ListSortSelectProps) {
  const { dict } = useTranslation();

  return (
    <Select value={value ?? 'recent'} onValueChange={(v) => onChange(v as MeListSort)}>
      <SelectTrigger className="w-[180px] h-9 bg-cinema-card/50 border-white/10 text-sm" aria-label={dict.activity?.sort?.label ?? 'Sort order'}>
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
