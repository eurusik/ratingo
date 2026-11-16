import type { Metadata } from 'next';
import { BRAND_NAME } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import { buildOpenGraph } from '@/shared/lib';
import type { BrowseCategorySlug } from './browse-category';
import { DEFAULT_BROWSE_STATE, browseHref } from './browse-state';

export function browseMetadata(locale: Locale, slug: BrowseCategorySlug): Metadata {
  const { title, description } = getDictionary(locale).browse.categories[slug];
  const canonical = browseHref(slug, DEFAULT_BROWSE_STATE);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: buildOpenGraph({
      locale,
      title: `${title} | ${BRAND_NAME}`,
      description,
      url: canonical,
    }),
  };
}
