import type { Metadata } from 'next';
import type { Dictionary, Locale } from '@/shared/i18n';

export interface RootMetadataOptions {
  locale: Locale;
  dict: Dictionary;
  siteUrl: string;
  indexingEnabled: boolean;
}

const SITE_NAME = 'Ratingo';
const DATA_SOURCE_KEYWORDS = ['TMDB', 'Trakt', 'IMDb'];

const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  uk: 'uk_UA',
  en: 'en_US',
};

const INDEXED_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-video-preview': -1,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
};

const HIDDEN_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export function buildRootMetadata({
  locale,
  dict,
  siteUrl,
  indexingEnabled,
}: RootMetadataOptions): Metadata {
  const { title, description, keywords } = dict.meta;

  return {
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description,
    keywords: [
      keywords.shows,
      keywords.movies,
      keywords.trending,
      keywords.ratings,
      ...DATA_SOURCE_KEYWORDS,
      keywords.country,
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: 'website',
      locale: OPEN_GRAPH_LOCALES[locale],
      url: '/',
      title,
      description,
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: indexingEnabled ? INDEXED_ROBOTS : HIDDEN_ROBOTS,
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    other: { 'mobile-web-app-capable': 'yes' },
  };
}
