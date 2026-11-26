import { isTelemetryRequest } from './telemetry-request-filter';

describe('isTelemetryRequest', () => {
  const ignore = isTelemetryRequest('http://alloy.railway.internal:4318');

  it('matches requests to the OTLP endpoint host and port', () => {
    expect(ignore({ origin: 'http://alloy.railway.internal:4318' })).toBe(true);
  });

  it('lets every other host through', () => {
    expect(ignore({ origin: 'https://api.themoviedb.org' })).toBe(false);
    expect(ignore({ origin: 'http://alloy.railway.internal:9999' })).toBe(false);
  });

  it('ignores nothing without an endpoint or an origin', () => {
    expect(isTelemetryRequest(undefined)({ origin: 'http://anything' })).toBe(false);
    expect(ignore({})).toBe(false);
  });

  it('survives a malformed endpoint', () => {
    expect(isTelemetryRequest('not a url')({ origin: 'http://anything' })).toBe(false);
  });
});
