import type { Metadata } from 'next';
import { BRAND_NAME } from '@/shared/config';
import type { Dictionary, Locale } from '@/shared/i18n';
import { buildOpenGraph } from './open-graph';
import { DEFAULT_SHARE_IMAGE } from './share-image';

export interface RootMetadataOptions {
  locale: Locale;
  dict: Dictionary;
  siteUrl: string;
  indexingEnabled: boolean;
}

const DATA_SOURCE_KEYWORDS = ['TMDB', 'Trakt', 'IMDb'];

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

const SITE_ICONS = {
  icon: [
    { url: '/favicon.ico', sizes: '32x32' },
    { url: '/icons/favicon.svg', type: 'image/svg+xml' },
  ],
  apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
} satisfies Metadata['icons'];

export function buildRootMetadata({
  locale,
  dict,
  siteUrl,
  indexingEnabled,
}: RootMetadataOptions): Metadata {
  const { title, description, keywords } = dict.meta;

  return {
    title: { default: title, template: `%s | ${BRAND_NAME}` },
    description,
    keywords: [
      keywords.shows,
      keywords.movies,
      keywords.trending,
      keywords.ratings,
      ...DATA_SOURCE_KEYWORDS,
      keywords.country,
    ],
    authors: [{ name: BRAND_NAME }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    metadataBase: new URL(siteUrl),
    openGraph: buildOpenGraph({ locale }),
    twitter: { card: 'summary_large_image', images: [DEFAULT_SHARE_IMAGE] },
    icons: SITE_ICONS,
    robots: indexingEnabled ? INDEXED_ROBOTS : HIDDEN_ROBOTS,
    appleWebApp: { capable: true, title: BRAND_NAME, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
  };
}
