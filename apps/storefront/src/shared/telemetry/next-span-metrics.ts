import {
  type Attributes,
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

import {
  FAILED_FETCH_STATUS,
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

function fetchAttributes(span: ReadableSpan): Attributes {
  return {
    'server.address': asString(span.attributes['net.peer.name']) ?? UNKNOWN_HOST,
    'http.request.method': normalizeMethod(span.attributes['http.method']),
    'next.fetch.cache_status':
      asString(span.attributes['next.fetch.cache_status']) ?? MISSING_LABEL,
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

  onStart(_span: Span): void {}

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
