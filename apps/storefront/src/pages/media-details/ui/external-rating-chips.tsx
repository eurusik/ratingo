import { Chip } from '@heroui/react';
import { RatingSourceLogo, type RatingSource } from '@/entities/media';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { formatsAsPercent, type ExternalRating } from '../model/details-view';

const CAPTIONS: Partial<Record<RatingSource, 'critics' | 'audience'>> = {
  rtCritics: 'critics',
  rtAudience: 'audience',
};

function shownValue({ source, value }: ExternalRating, locale: string): string {
  if (formatsAsPercent(source)) return `${Math.round(value)}%`;
  if (source === 'metacritic') return String(Math.round(value));
  return formatScore(locale, value);
}

export function ExternalRatingChips({ ratings }: { ratings: ExternalRating[] }) {
  const { dict, locale } = useTranslation();

  return (
    <ul aria-label={dict.details.ratings.list} className="flex flex-wrap gap-2">
      {ratings.map((rating) => {
        const shown = shownValue(rating, locale);
        const caption = CAPTIONS[rating.source];
        return (
          <li key={rating.source}>
            <Chip
              size="lg"
              className="h-9 gap-1.5 bg-default px-3 text-sm font-extrabold tabular-nums md:h-10 md:px-3.5 md:text-[15px]"
            >
              <RatingSourceLogo source={rating.source} />
              <span aria-hidden>{shown}</span>
              {caption ? (
                <span aria-hidden className="text-xs font-semibold text-muted">
                  {dict.details.ratings[caption]}
                </span>
              ) : null}
              <span className="sr-only">
                {interpolate(dict.details.ratings[rating.source], {
                  score: shown,
                  percent: Math.round(rating.value),
                })}
              </span>
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}
