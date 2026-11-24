import fc from 'fast-check';

import {
  InvalidLandingPageConfigError,
  LANDING_PAGE_HEADERS,
  NEUTRAL_NOT_FOUND,
  NEUTRAL_NOT_FOUND_BODY,
  renderLandingPage,
  type LandingPageConfig,
} from './landing-page';

const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

const config: LandingPageConfig = {
  title: 'Title',
  subtitle: 'Subtitle',
  accentColor: '#112233',
  avatarSrc: PIXEL,
  language: 'uk',
  eyebrow: 'Eyebrow',
  readouts: [{ label: 'Label', value: 'Value' }],
};

describe('renderLandingPage', () => {
  it('returns a strict static html response', () => {
    const response = renderLandingPage(config);
    expect(response.status).toBe(200);
    expect(response.headers).toEqual({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    expect(response.headers).toBe(LANDING_PAGE_HEADERS);
  });

  it('inlines title, subtitle and avatar without scripts or external urls', () => {
    const { body } = renderLandingPage(config);
    expect(body).toContain('<title>Title</title>');
    expect(body).toContain('<p class="subtitle">Subtitle</p>');
    expect(body).toContain(`src="${PIXEL}"`);
    expect(body).not.toContain('<script');
    expect(body).not.toMatch(/https?:\/\//);
  });

  it('never lets text break out of its element', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        (title, subtitle, eyebrow, value) => {
          const { body } = renderLandingPage({
            ...config,
            title,
            subtitle,
            eyebrow,
            readouts: [{ label: value, value }],
          });
          expect(body.match(/<script/gi)).toBeNull();
          expect(body.match(/<h1>/g)).toHaveLength(1);
          expect(body.match(/<p class="subtitle">/g)).toHaveLength(1);
        },
      ),
    );
  });

  it('omits the subtitle paragraph when none is given', () => {
    const { body } = renderLandingPage({ ...config, subtitle: undefined });
    expect(body).not.toContain('class="subtitle"');
  });

  it.each([
    { accentColor: 'red' },
    { accentColor: '#12345' },
    { avatarSrc: 'https://example.com/a.png' },
    { avatarSrc: 'data:text/html;base64,PHNjcmlwdD4=' },
    { language: '"><script>' },
  ])('rejects unsafe config %p', (override) => {
    expect(() => renderLandingPage({ ...config, ...override })).toThrow(
      InvalidLandingPageConfigError,
    );
  });
});

describe('NEUTRAL_NOT_FOUND', () => {
  it('is a fixed body that names no route or framework', () => {
    expect(NEUTRAL_NOT_FOUND.status).toBe(404);
    expect(NEUTRAL_NOT_FOUND.body).toBe(NEUTRAL_NOT_FOUND_BODY);
    expect(JSON.parse(NEUTRAL_NOT_FOUND.body)).toEqual({ statusCode: 404, message: 'Not Found' });
  });
});
