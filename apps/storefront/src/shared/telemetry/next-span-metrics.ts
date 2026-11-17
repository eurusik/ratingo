import type { Attributes, AttributeValue, Histogram, HrTime, Meter } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-node';

import {
  DURATION_BUCKETS_SECONDS,
  FETCH_DURATION_METRIC,
  HTTP_REQUEST_DURATION_METRIC,
  KNOWN_HTTP_METHODS,
  NEXT_SPAN_TYPE,
  OTHER_METHOD,
  RENDER_DURATION_METRIC,
  UNKNOWN_HOST,
  UNMATCHED_ROUTE,
} from './constants';

const NS_PER_SECOND = 1e9;

export const toSeconds = ([seconds, nanos]: HrTime): number => seconds + nanos / NS_PER_SECOND;

const asString = (value: AttributeValue | undefined): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asNumber = (value: AttributeValue | undefined): number | undefined =>
  typeof value === 'number' ? value : undefined;

export const normalizeMethod = (value: AttributeValue | undefined): string => {
  const method = asString(value)?.toUpperCase();
  return method && KNOWN_HTTP_METHODS.has(method) ? method : OTHER_METHOD;
};

const routeOf = (attributes: Attributes): string =>
  asString(attributes['next.route']) ?? UNMATCHED_ROUTE;

function requestAttributes(attributes: Attributes): Attributes {
  return {
    'http.request.method': normalizeMethod(attributes['http.method']),
    'http.route': routeOf(attributes),
    'http.response.status_code': asNumber(attributes['http.status_code']) ?? 0,
    'next.rsc': attributes['next.rsc'] === true,
  };
}

function renderAttributes(attributes: Attributes): Attributes {
  return { 'http.route': routeOf(attributes) };
}

function fetchAttributes(attributes: Attributes): Attributes {
  return {
    'server.address': asString(attributes['net.peer.name']) ?? UNKNOWN_HOST,
    'http.request.method': normalizeMethod(attributes['http.method']),
    'http.response.status_code': asNumber(attributes['http.status_code']) ?? 0,
    'next.fetch.cache_status': asString(attributes['next.fetch.cache_status']) ?? 'none',
  };
}

interface SpanMetric {
  histogram: Histogram;
  toAttributes: (attributes: Attributes) => Attributes;
}

export class NextSpanMetricsProcessor implements SpanProcessor {
  private readonly bySpanType: ReadonlyMap<string, SpanMetric>;

  constructor(meter: Meter) {
    const histogram = (name: string, description: string) =>
      meter.createHistogram(name, {
        description,
        unit: 's',
        advice: { explicitBucketBoundaries: DURATION_BUCKETS_SECONDS },
      });

    this.bySpanType = new Map<string, SpanMetric>([
      [
        NEXT_SPAN_TYPE.REQUEST,
        {
          histogram: histogram(HTTP_REQUEST_DURATION_METRIC, 'Duration of requests handled by Next.js'),
          toAttributes: requestAttributes,
        },
      ],
      [
        NEXT_SPAN_TYPE.RENDER,
        {
          histogram: histogram(RENDER_DURATION_METRIC, 'Duration of App Router server rendering'),
          toAttributes: renderAttributes,
        },
      ],
      [
        NEXT_SPAN_TYPE.FETCH,
        {
          histogram: histogram(FETCH_DURATION_METRIC, 'Duration of fetch calls made during rendering'),
          toAttributes: fetchAttributes,
        },
      ],
    ]);
  }

  onStart(_span: Span): void {}

  onEnd(span: ReadableSpan): void {
    const spanType = asString(span.attributes['next.span_type']);
    const metric = spanType ? this.bySpanType.get(spanType) : undefined;
    if (!metric) {
      return;
    }
    metric.histogram.record(toSeconds(span.duration), metric.toAttributes(span.attributes));
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
