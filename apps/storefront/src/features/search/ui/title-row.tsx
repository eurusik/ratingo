import type { ReactNode } from 'react';
import { GridListItem } from 'react-aria-components';
import { listboxItemVariants } from '@heroui/react';
import { MediaPoster, ScoreChip, useScoreLabel } from '@/entities/media';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { SearchTitle } from '../model/search-title';

const ROW_CLASS = listboxItemVariants().item({
  className:
    'min-h-tap gap-3 px-2 py-2 outline-none data-[focused=true]:bg-surface-secondary data-[hovered=true]:bg-surface-secondary data-[focus-visible=true]:ring-0! data-[focus-visible=true]:ring-offset-0! data-[focus-visible=true]:outline-2 data-[focus-visible=true]:-outline-offset-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-solid',
});

interface TitleRowProps {
  title: SearchTitle;
  rank?: number;
  trailing?: ReactNode;
}

export function TitleRow({ title, rank, trailing }: TitleRowProps) {
  const { dict } = useTranslation();
  const scoreLabel = useScoreLabel();
  const details = [dict.media.type[title.type], title.year].filter(Boolean).join(' · ');
  const alsoKnownAs = title.alsoKnownAs
    ? interpolate(dict.search.alsoKnownAs, { title: title.alsoKnownAs })
    : undefined;
  const label = [
    rank === undefined ? title.title : `${rank}. ${title.title}`,
    alsoKnownAs,
    details,
    title.score === undefined ? undefined : scoreLabel(title.score),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <GridListItem id={title.key} textValue={label} className={ROW_CLASS}>
      {rank === undefined ? null : (
        <span
          aria-hidden
          className="w-4 shrink-0 text-center text-sm font-bold text-muted tabular-nums"
        >
          {rank}
        </span>
      )}
      <MediaPoster type={title.type} posterUrl={title.posterUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold text-foreground">{title.title}</span>
        {alsoKnownAs ? <span className="truncate text-xs text-muted">{alsoKnownAs}</span> : null}
        <span className="text-xs text-muted tabular-nums">{details}</span>
      </span>
      {title.score === undefined ? null : <ScoreChip score={title.score} />}
      {trailing}
    </GridListItem>
  );
}
