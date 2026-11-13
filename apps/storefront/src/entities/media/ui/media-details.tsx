import { Fragment } from 'react';
import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation, type Locale } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';
import type { TrendingMedia } from '../model/media';

const SHORTENED_FROM = 1000;

interface PluralForms {
  one: string;
  few: string;
  many: string;
}

function watchingNowLabel(count: number, forms: PluralForms, locale: Locale) {
  const shortCount = formatCompactCount(locale, count);
  const template = count >= SHORTENED_FROM ? forms.many : pluralize(count, forms, locale);
  return { shortCount, label: interpolate(template, { count: shortCount }) };
}

export function useWatchingNowLabel(count: number) {
  const { dict, locale } = useTranslation();
  return watchingNowLabel(count, dict.media.watchingNow, locale);
}

export function MediaDetails({
  media,
}: {
  media: Pick<TrendingMedia, 'type' | 'year' | 'watchingNow'>;
}) {
  const { dict, locale } = useTranslation();
  const watching =
    media.watchingNow === undefined
      ? undefined
      : watchingNowLabel(media.watchingNow, dict.media.watchingNowShort, locale).label;
  const parts = [dict.media.type[media.type], media.year, watching].filter(Boolean);

  return parts.map((part, index) => (
    <Fragment key={part}>
      {index > 0 ? ' · ' : null}
      <span className="whitespace-nowrap">{part}</span>
    </Fragment>
  ));
}
