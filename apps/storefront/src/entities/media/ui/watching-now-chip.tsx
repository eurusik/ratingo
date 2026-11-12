import { Chip } from '@heroui/react';
import { Popcorn } from 'lucide-react';
import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';

const SHORTENED_FROM = 1000;

export function WatchingNowChip({ count }: { count: number }) {
  const { dict, locale } = useTranslation();
  const shortCount = formatCompactCount(locale, count);
  const forms = dict.media.watchingNow;
  const template = count >= SHORTENED_FROM ? forms.many : pluralize(count, forms, locale);
  const label = interpolate(template, { count: shortCount });

  return (
    <Chip
      size="md"
      title={label}
      className="gap-1.5 bg-black/80 ps-2 text-xs font-extrabold text-white tabular-nums"
    >
      <Popcorn aria-hidden className="size-3.5" />
      <span aria-hidden>{shortCount}</span>
      <span className="sr-only">{label}</span>
    </Chip>
  );
}
