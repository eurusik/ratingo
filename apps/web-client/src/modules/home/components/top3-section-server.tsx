/**
 * Server-rendered Top-3 section for SSR/SSG.
 *
 * Fully rendered on server for SEO.
 */

import { MediaCardServer, type MediaCardServerProps } from './media-card/media-card-server';
import { getDictionary, type Locale } from '@/shared/i18n';

type MediaItem = Omit<MediaCardServerProps, 'rank' | 'locale'>;

interface Top3SectionServerProps {
  items: MediaItem[];
  title?: string;
  locale?: Locale;
  className?: string;
}

/**
 * SSR-safe Top-3 section.
 *
 * Renders 3 cards in a grid, fully on server.
 */
export function Top3SectionServer({ items, title, locale = 'uk', className }: Top3SectionServerProps) {
  const dict = getDictionary(locale);

  if (!Array.isArray(items) || items.length < 3) return null;

  const top3 = items.slice(0, 3);

  return (
    <section className={className}>
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <span>🏆</span>
        <span>{title || dict.home.sections.top3 || 'Топ-3'}</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {top3.map((item, index) => (
          <MediaCardServer key={item.id} {...item} rank={index + 1} locale={locale} />
        ))}
      </div>
    </section>
  );
}
