type JsonLdData = Record<string, unknown>;

const SITE_NAME = 'Ratingo';
const SITE_LANGUAGE = 'uk';
const ORGANIZATION_DESCRIPTION =
  'Український сервіс для відкриття стрімінгового контенту — серіали та фільми';
const ORGANIZATION_PROFILES = ['https://github.com/ratingo'];
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
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/icon.png`,
    description: ORGANIZATION_DESCRIPTION,
    sameAs: ORGANIZATION_PROFILES,
  };
}

export function buildWebSiteJsonLd(siteUrl: string): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl,
    inLanguage: SITE_LANGUAGE,
  };
}
