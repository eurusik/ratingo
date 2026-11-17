import { render } from '@testing-library/react';
import { SiteAnalytics, googleTagBootstrap } from './site-analytics';

const GOOGLE_TAG = 'https://www.googletagmanager.com/gtag/js?id=G-TEST';

jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ id, src, children }: { id?: string; src?: string; children?: string }) => (
    <script data-testid={id ?? src}>{children}</script>
  ),
}));

describe('SiteAnalytics', () => {
  it('renders nothing without analytics ids', () => {
    const { container } = render(
      <SiteAnalytics googleMeasurementId={null} clarityProjectId={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('loads the Clarity tag for the project id', () => {
    const { getByTestId, queryByTestId } = render(
      <SiteAnalytics googleMeasurementId={null} clarityProjectId="abc123" />,
    );

    expect(getByTestId('microsoft-clarity').textContent).toContain(
      'https://www.clarity.ms/tag/abc123',
    );
    expect(queryByTestId(GOOGLE_TAG)).toBeNull();
  });

  it('loads Google Analytics alongside Clarity', () => {
    const { getByTestId } = render(
      <SiteAnalytics googleMeasurementId="G-TEST" clarityProjectId="abc123" />,
    );

    expect(getByTestId(GOOGLE_TAG)).toBeInTheDocument();
    expect(getByTestId('microsoft-clarity')).toBeInTheDocument();
  });
});

describe('googleTagBootstrap', () => {
  it('configures the measurement id without OAuth secrets in the page location', () => {
    const script = googleTagBootstrap('G-TEST');

    expect(script).toContain('gtag(\'config\', "G-TEST"');
    expect(script).toContain("['code', 'state', 'token']");
  });
});
