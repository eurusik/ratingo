import { render } from '@testing-library/react';
import { SiteAnalytics, clarityBootstrap, googleTagBootstrap } from './site-analytics';

const GOOGLE_TAG = 'https://www.googletagmanager.com/gtag/js?id=G-TEST';

jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ id, src, children }: { id?: string; src?: string; children?: string }) => (
    <script data-testid={id ?? src}>{children}</script>
  ),
}));

describe('SiteAnalytics', () => {
  it('renders nothing without a measurement id', () => {
    const { container } = render(<SiteAnalytics googleMeasurementId={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('loads the Google tag for the measurement id', () => {
    const { getByTestId } = render(<SiteAnalytics googleMeasurementId="G-TEST" />);

    expect(getByTestId(GOOGLE_TAG)).toBeInTheDocument();
  });
});

describe('clarityBootstrap', () => {
  it('queues calls on window.clarity and loads the tag for the project id', () => {
    const script = clarityBootstrap('abc123');

    expect(script).toContain('c[a].q=c[a].q||[]');
    expect(script).toContain('"https://www.clarity.ms/tag/abc123"');
  });
});

describe('googleTagBootstrap', () => {
  it('configures the measurement id without OAuth secrets in the page location', () => {
    const script = googleTagBootstrap('G-TEST');

    expect(script).toContain('gtag(\'config\', "G-TEST"');
    expect(script).toContain("['code', 'state', 'token']");
  });
});
