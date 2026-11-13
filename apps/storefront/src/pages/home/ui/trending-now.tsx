'use client';

import { useRef, useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { SegmentedFilter } from '@/shared/ui';
import { TYPE_FILTERS, type TrendingHighlights, type TypeFilter } from '../model/home-feed';
import { MediaRail } from './media-rail';

export function TrendingNow({ highlights }: { highlights: TrendingHighlights }) {
  const { dict } = useTranslation();
  const [filter, setFilter] = useState<TypeFilter>('all');
  const scroller = useRef<HTMLDivElement>(null);
  const labels = dict.home.typeFilter;
  const options = TYPE_FILTERS.filter((id) => highlights[id].length > 0).map((id) => ({
    id,
    label: labels[id],
  }));

  if (highlights.all.length === 0) return null;

  const activeFilter = highlights[filter].length > 0 ? filter : 'all';

  const changeFilter = (next: TypeFilter) => {
    setFilter(next);
    if (scroller.current) scroller.current.scrollLeft = 0;
  };

  return (
    <MediaRail
      id="trending-now"
      title={dict.home.trending}
      items={highlights[activeFilter]}
      scrollerRef={scroller}
      toolbar={
        options.length > 2 ? (
          <SegmentedFilter
            label={labels.label}
            options={options}
            value={activeFilter}
            onChange={changeFilter}
            className="md:px-0"
          />
        ) : null
      }
    />
  );
}
