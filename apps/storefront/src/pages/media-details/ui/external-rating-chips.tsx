import { Chip } from '@heroui/react';
import { RatingSourceLogo, type RatingSource } from '@/entities/media';
import { getDictionary, interpolate, type Locale } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { formatPercent } from '../model/details-format';
import type { ExternalRating } from '../model/details-view';

const PERCENT_SOURCES = new Set<RatingSource>(['rtCritics', 'rtAudience', 'trakt']);
const CAPTIONS: Partial<Record<RatingSource, 'critics' | 'audience'>> = {
  rtCritics: 'critics',
  rtAudience: 'audience',
};

function shownValue({ source, value }: ExternalRating, locale: Locale): string {
  if (PERCENT_SOURCES.has(source)) return formatPercent(value, locale);
  if (source === 'metacritic') return String(Math.round(value));
  return formatScore(locale, value);
}

export function ExternalRatingChips({
  ratings,
  locale,
}: {
  ratings: ExternalRating[];
  locale: Locale;
}) {
  const dict = getDictionary(locale).details.ratings;

  return (
    <ul role="list" aria-label={dict.list} className="flex flex-wrap gap-2">
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
                  {dict[caption]}
                </span>
              ) : null}
              <span className="sr-only">
                {interpolate(dict[rating.source], { score: shown, percent: shown })}
              </span>
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}
