import type { Metadata } from 'next';
import { SectionPlaceholderPage } from '@/pages/section-placeholder';
import { DEFAULT_LOCALE, getDictionary } from '@/shared/i18n';

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = { title: dict.nav.browse };

export default function BrowseRoute() {
  return <SectionPlaceholderPage locale={DEFAULT_LOCALE} section="browse" />;
}
