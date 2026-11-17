import {
  type Attributes,
  type Histogram,
  type HrTime,
  type Meter,
  SpanStatusCode,
} from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-node';

import {
  FETCH_DURATION_METRIC,
  RENDER_DURATION_METRIC,
  REQUEST_DURATION_METRIC,
} from './constants';
import { NextSpanMetricsProcessor, normalizeMethod, toSeconds } from './next-span-metrics';

function fakeMeter() {
  const histograms = new Map<string, jest.Mock>();
  const meter = {
    createHistogram: (name: string) => {
      const record = jest.fn();
      histograms.set(name, record);
      return { record } as unknown as Histogram;
    },
  } as unknown as Meter;
  return { processor: new NextSpanMetricsProcessor(meter), histograms };
}

const span = (
  attributes: Attributes,
  {
    duration = [0, 250_000_000],
    status = SpanStatusCode.UNSET,
  }: { duration?: HrTime; status?: SpanStatusCode } = {},
) => ({ attributes, duration, status: { code: status } }) as unknown as ReadableSpan;

const fetchSpan = (attributes: Attributes, status?: SpanStatusCode) =>
  span(
    {
      'next.span_type': 'AppRender.fetch',
      'http.method': 'GET',
      'net.peer.name': 'api.railway.internal',
      ...attributes,
    },
    { status },
  );

describe('NextSpanMetricsProcessor', () => {
  it('records request duration by route, status and RSC flag', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      span({
        'next.span_type': 'BaseServer.handleRequest',
        'http.method': 'GET',
        'http.status_code': 200,
        'next.route': '/movie/[slug]',
        'next.rsc': true,
      }),
    );

    expect(histograms.get(REQUEST_DURATION_METRIC)).toHaveBeenCalledWith(0.25, {
      'http.request.method': 'GET',
      'http.route': '/movie/[slug]',
      'http.response.status_code': 200,
      'next.rsc': true,
    });
  });

  it('labels requests without a matched route as unmatched and leaves out a missing status', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      span({ 'next.span_type': 'BaseServer.handleRequest', 'http.method': 'PROPFIND' }),
    );

    expect(histograms.get(REQUEST_DURATION_METRIC)).toHaveBeenCalledWith(0.25, {
      'http.request.method': '_OTHER',
      'http.route': 'unmatched',
      'next.rsc': false,
    });
  });

  it('records render duration by route', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      span(
        { 'next.span_type': 'AppRender.getBodyResult', 'next.route': '/' },
        { duration: [1, 500_000_000] },
      ),
    );

    expect(histograms.get(RENDER_DURATION_METRIC)).toHaveBeenCalledWith(1.5, { 'http.route': '/' });
  });

  it('records fetch duration by host, status and cache status without the URL', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      fetchSpan({
        'http.url': 'http://api.railway.internal:3000/api/catalog/movies/123',
        'http.status_code': 200,
        'next.fetch.cache_status': 'hit',
      }),
    );

    expect(histograms.get(FETCH_DURATION_METRIC)).toHaveBeenCalledWith(0.25, {
      'server.address': 'api.railway.internal',
      'http.request.method': 'GET',
      'http.response.status_code': 200,
      'next.fetch.cache_status': 'hit',
    });
  });

  it('labels a fetch that threw with status 0', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(fetchSpan({}, SpanStatusCode.ERROR));

    expect(histograms.get(FETCH_DURATION_METRIC)).toHaveBeenCalledWith(
      0.25,
      expect.objectContaining({ 'http.response.status_code': 0 }),
    );
  });

  it('leaves out the status of a fetch Next.js did not track instead of reporting a failure', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(fetchSpan({}));

    expect(histograms.get(FETCH_DURATION_METRIC)).toHaveBeenCalledWith(0.25, {
      'server.address': 'api.railway.internal',
      'http.request.method': 'GET',
      'next.fetch.cache_status': 'none',
    });
  });

  it('ignores spans that are not tracked', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(span({ 'next.span_type': 'NextNodeServer.findPageComponents' }));
    processor.onEnd(span({}));

    expect(histograms.size).toBe(3);
    histograms.forEach((record) => expect(record).not.toHaveBeenCalled());
  });
});

describe('helpers', () => {
  it('converts HrTime to seconds', () => {
    expect(toSeconds([2, 5_000_000])).toBeCloseTo(2.005);
  });

  it('normalizes HTTP methods', () => {
    expect(normalizeMethod('get')).toBe('GET');
    expect(normalizeMethod(undefined)).toBe('_OTHER');
    expect(normalizeMethod('TRACE')).toBe('_OTHER');
  });
});
