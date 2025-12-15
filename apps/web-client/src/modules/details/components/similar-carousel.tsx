/**
 * Similar items carousel
 */

import { MediaCardServer, type MediaCardServerProps } from '@/modules/home';
import type { getDictionary } from '@/shared/i18n';

export interface SimilarCarouselProps {
  items: Omit<MediaCardServerProps, 'locale'>[];
  locale?: 'uk' | 'en';
  dict: ReturnType<typeof getDictionary>;
}

export function SimilarCarousel({ items, locale = 'uk', dict }: SimilarCarouselProps) {

  if (!items || items.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 mb-3">
        {dict.details.similar.title}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <MediaCardServer
            key={item.id}
            {...item}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
