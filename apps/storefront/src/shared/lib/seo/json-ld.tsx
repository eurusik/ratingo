import { BRAND_NAME, EXTERNAL_LINKS } from '@/shared/config';

type JsonLdData = Record<string, unknown>;

const SITE_LANGUAGE = 'uk';
const ORGANIZATION_DESCRIPTION =
  'Український сервіс для відкриття стрімінгового контенту — серіали та фільми';
const ORGANIZATION_LOGO_PATH = '/icons/icon-512x512.png';
const SCRIPT_TAG_OPENER = /</g;

function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify(data).replace(SCRIPT_TAG_OPENER, '\\u003c');
}

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
  );
}

export function buildOrganizationJsonLd(siteUrl: string): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    url: siteUrl,
    logo: `${siteUrl}${ORGANIZATION_LOGO_PATH}`,
    description: ORGANIZATION_DESCRIPTION,
    sameAs: [EXTERNAL_LINKS.github],
  };
}

export function buildWebSiteJsonLd(siteUrl: string): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    url: siteUrl,
    inLanguage: SITE_LANGUAGE,
  };
}
