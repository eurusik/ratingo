import { render } from '@testing-library/react';
import { SiteAnalytics, clarityQueueStub, googleTagBootstrap } from './site-analytics';

const GOOGLE_TAG = 'https://www.googletagmanager.com/gtag/js?id=G-TEST';
const CLARITY_TAG = 'https://www.clarity.ms/tag/abc123';

jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ src, strategy }: { src?: string; strategy?: string }) => (
    <script data-testid={src} data-strategy={strategy} />
  ),
}));

describe('SiteAnalytics', () => {
  it('renders nothing without ids', () => {
    const { container } = render(
      <SiteAnalytics googleMeasurementId={null} clarityProjectId={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('loads the Google tag once interactive and Clarity after the page has loaded', () => {
    const { getByTestId } = render(
      <SiteAnalytics googleMeasurementId="G-TEST" clarityProjectId="abc123" />,
    );

    expect(getByTestId(GOOGLE_TAG)).toHaveAttribute('data-strategy', 'afterInteractive');
    expect(getByTestId(CLARITY_TAG)).toHaveAttribute('data-strategy', 'lazyOnload');
  });
});

describe('clarityQueueStub', () => {
  it('queues calls on window.clarity until the tag loads', () => {
    const script = clarityQueueStub();

    expect(script).toContain('window.clarity.q=window.clarity.q||[]');
    expect(script).not.toContain('clarity.ms');
  });
});

describe('googleTagBootstrap', () => {
  it('configures the measurement id without OAuth secrets in the page location', () => {
    const script = googleTagBootstrap('G-TEST');

    expect(script).toContain('gtag(\'config\', "G-TEST"');
    expect(script).toContain("['code', 'state', 'token']");
  });
});
