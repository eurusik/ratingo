import {
  type Attributes,
  type Context,
  type AttributeValue,
  type Histogram,
  type HrTime,
  type Meter,
  SpanStatusCode,
} from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-node';
import {
  HTTP_DURATION_BUCKETS_SECONDS,
  NS_PER_SECOND,
  UNMATCHED_ROUTE,
} from '@ratingo/node-telemetry';

import { clientKindOf } from './client-kind-propagator';
import {
  CLIENT_KIND,
  CLIENT_KIND_LABEL,
  CLIENT_KIND_SPAN_ATTRIBUTE,
  COLD_CACHE_ENTRY_REASON,
  FAILED_FETCH_STATUS,
  FETCH_CACHE_STATUS,
  FETCH_DURATION_METRIC,
  KNOWN_HTTP_METHODS,
  MISSING_LABEL,
  NEXT_SPAN_TYPE,
  OTHER_METHOD,
  RENDER_DURATION_METRIC,
  REQUEST_DURATION_METRIC,
  UNKNOWN_HOST,
} from './constants';

export const toSeconds = ([seconds, nanos]: HrTime): number => seconds + nanos / NS_PER_SECOND;

const asString = (value: AttributeValue | undefined): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asNumber = (value: AttributeValue | undefined): number | undefined =>
  typeof value === 'number' ? value : undefined;

export const normalizeMethod = (value: AttributeValue | undefined): string => {
  const method = asString(value)?.toUpperCase();
  return method && KNOWN_HTTP_METHODS.has(method) ? method : OTHER_METHOD;
};

const routeOf = ({ attributes }: ReadableSpan): string =>
  asString(attributes['next.route']) ?? UNMATCHED_ROUTE;

const statusAttribute = (status: number | undefined): Attributes =>
  status === undefined ? {} : { 'http.response.status_code': status };

function requestAttributes(span: ReadableSpan): Attributes {
  return {
    'http.request.method': normalizeMethod(span.attributes['http.method']),
    'http.route': routeOf(span),
    'next.rsc': span.attributes['next.rsc'] === true,
    [CLIENT_KIND_LABEL]: asString(span.attributes[CLIENT_KIND_SPAN_ATTRIBUTE]) ?? CLIENT_KIND.HUMAN,
    ...statusAttribute(asNumber(span.attributes['http.status_code'])),
  };
}

function renderAttributes(span: ReadableSpan): Attributes {
  return { 'http.route': routeOf(span) };
}

function fetchStatus(span: ReadableSpan): number | undefined {
  const status = asNumber(span.attributes['http.status_code']);
  if (status !== undefined) {
    return status;
  }
  return span.status.code === SpanStatusCode.ERROR ? FAILED_FETCH_STATUS : undefined;
}

function fetchCacheStatus({ attributes }: ReadableSpan): string {
  const status = asString(attributes['next.fetch.cache_status']) ?? MISSING_LABEL;
  const reason = asString(attributes['next.fetch.cache_reason']);
  return status === FETCH_CACHE_STATUS.SKIP && reason?.includes(COLD_CACHE_ENTRY_REASON)
    ? FETCH_CACHE_STATUS.MISS
    : status;
}

function fetchAttributes(span: ReadableSpan): Attributes {
  return {
    'server.address': asString(span.attributes['net.peer.name']) ?? UNKNOWN_HOST,
    'http.request.method': normalizeMethod(span.attributes['http.method']),
    'next.fetch.cache_status': fetchCacheStatus(span),
    ...statusAttribute(fetchStatus(span)),
  };
}

interface SpanMetric {
  histogram: Histogram;
  toAttributes: (span: ReadableSpan) => Attributes;
}

export class NextSpanMetricsProcessor implements SpanProcessor {
  private readonly bySpanType: ReadonlyMap<string, SpanMetric>;

  constructor(meter: Meter) {
    const histogram = (name: string, description: string) =>
      meter.createHistogram(name, {
        description,
        unit: 's',
        advice: { explicitBucketBoundaries: HTTP_DURATION_BUCKETS_SECONDS },
      });

    this.bySpanType = new Map<string, SpanMetric>([
      [
        NEXT_SPAN_TYPE.REQUEST,
        {
          histogram: histogram(REQUEST_DURATION_METRIC, 'Duration of requests handled by Next.js'),
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
          histogram: histogram(
            FETCH_DURATION_METRIC,
            'Duration of fetch calls made during rendering',
          ),
          toAttributes: fetchAttributes,
        },
      ],
    ]);
  }

  onStart(span: Span, parentContext: Context): void {
    if (asString(span.attributes['next.span_type']) === NEXT_SPAN_TYPE.REQUEST) {
      span.setAttribute(CLIENT_KIND_SPAN_ATTRIBUTE, clientKindOf(parentContext));
    }
  }

  onEnd(span: ReadableSpan): void {
    const spanType = asString(span.attributes['next.span_type']);
    const metric = spanType ? this.bySpanType.get(spanType) : undefined;
    if (!metric) {
      return;
    }
    metric.histogram.record(toSeconds(span.duration), metric.toAttributes(span));
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
