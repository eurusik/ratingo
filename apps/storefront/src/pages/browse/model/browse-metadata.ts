import type { Metadata } from 'next';
import { BRAND_NAME } from '@/shared/config';
import { getDictionary, type Locale } from '@/shared/i18n';
import type { BrowseCategorySlug } from './browse-category';
import { NO_FILTERS, browseHref } from './browse-state';

export function browseMetadata(locale: Locale, slug: BrowseCategorySlug): Metadata {
  const { title, description } = getDictionary(locale).browse.categories[slug];

  return {
    title,
    description,
    alternates: { canonical: browseHref(slug, { sort: 'recommended', filters: NO_FILTERS }) },
    openGraph: { title: `${title} | ${BRAND_NAME}`, description },
  };
}
