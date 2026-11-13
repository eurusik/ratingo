import { render } from '@testing-library/react';
import { JsonLd, buildOrganizationJsonLd, buildWebSiteJsonLd } from './json-ld';

describe('buildWebSiteJsonLd', () => {
  it('declares the site name for search results', () => {
    expect(buildWebSiteJsonLd('https://ratingo.top')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Ratingo',
      url: 'https://ratingo.top',
      inLanguage: 'uk',
    });
  });
});

describe('buildOrganizationJsonLd', () => {
  it('points the logo at the site icon', () => {
    expect(buildOrganizationJsonLd('https://ratingo.top')).toMatchObject({
      '@type': 'Organization',
      url: 'https://ratingo.top',
      logo: 'https://ratingo.top/icons/icon-512x512.png',
      sameAs: ['https://github.com/eurusik/ratingo'],
    });
  });
});

describe('JsonLd', () => {
  it('escapes markup so data cannot close the script tag', () => {
    const { container } = render(<JsonLd data={{ name: '</script><b>x</b>' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script?.innerHTML).not.toContain('</script>');
    expect(JSON.parse(script?.textContent ?? '')).toEqual({ name: '</script><b>x</b>' });
  });
});
