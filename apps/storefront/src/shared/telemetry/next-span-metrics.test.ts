import {
  type Attributes,
  ROOT_CONTEXT,
  defaultTextMapGetter,
  type Histogram,
  type HrTime,
  type Meter,
  SpanStatusCode,
} from '@opentelemetry/api';
import type { ReadableSpan, Span } from '@opentelemetry/sdk-trace-node';

import { ClientKindPropagator } from './client-kind-propagator';
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
      client_kind: 'human',
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
      client_kind: 'human',
    });
  });

  it('labels a request with the client kind recorded on its span', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      span({
        'next.span_type': 'BaseServer.handleRequest',
        'http.method': 'GET',
        'ratingo.client_kind': 'ai_crawler',
      }),
    );

    expect(histograms.get(REQUEST_DURATION_METRIC)).toHaveBeenCalledWith(
      0.25,
      expect.objectContaining({ client_kind: 'ai_crawler' }),
    );
  });

  it('stamps request spans with the client kind found in the propagated context', () => {
    const { processor } = fakeMeter();
    const context = new ClientKindPropagator().extract(
      ROOT_CONTEXT,
      { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2)' },
      defaultTextMapGetter,
    );
    const setAttribute = jest.fn();

    processor.onStart(
      {
        attributes: { 'next.span_type': 'BaseServer.handleRequest' },
        setAttribute,
      } as unknown as Span,
      context,
    );

    expect(setAttribute).toHaveBeenCalledWith('ratingo.client_kind', 'ai_crawler');
  });

  it('leaves spans other than requests unstamped', () => {
    const { processor } = fakeMeter();
    const setAttribute = jest.fn();

    processor.onStart(
      { attributes: { 'next.span_type': 'AppRender.fetch' }, setAttribute } as unknown as Span,
      ROOT_CONTEXT,
    );

    expect(setAttribute).not.toHaveBeenCalled();
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

  it('labels a skip with no cache entry yet as a miss', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      fetchSpan({
        'http.status_code': 200,
        'next.fetch.cache_status': 'skip',
        'next.fetch.cache_reason': 'cache-control: no-cache (hard refresh)',
      }),
    );

    expect(histograms.get(FETCH_DURATION_METRIC)).toHaveBeenCalledWith(
      0.25,
      expect.objectContaining({ 'next.fetch.cache_status': 'miss' }),
    );
  });

  it('keeps a skip that bypasses the cache on purpose', () => {
    const { processor, histograms } = fakeMeter();
    processor.onEnd(
      fetchSpan({
        'http.status_code': 200,
        'next.fetch.cache_status': 'skip',
        'next.fetch.cache_reason': 'revalidate: 0',
      }),
    );

    expect(histograms.get(FETCH_DURATION_METRIC)).toHaveBeenCalledWith(
      0.25,
      expect.objectContaining({ 'next.fetch.cache_status': 'skip' }),
    );
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
