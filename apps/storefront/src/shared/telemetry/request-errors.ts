import { type Counter, metrics } from '@opentelemetry/api';
import type { Instrumentation } from 'next';

import { METER_NAME, MISSING_LABEL, REQUEST_ERRORS_METRIC, UNMATCHED_ROUTE } from './constants';

type RequestErrorContext = Parameters<Instrumentation.onRequestError>[2];

let errorCounter: Counter | undefined;

const getErrorCounter = (): Counter => {
  errorCounter ??= metrics.getMeter(METER_NAME).createCounter(REQUEST_ERRORS_METRIC, {
    description: 'Errors captured by the Next.js onRequestError hook',
  });
  return errorCounter;
};

function requestErrorAttributes(context: RequestErrorContext) {
  return {
    'http.route': context.routePath || UNMATCHED_ROUTE,
    'next.route_type': context.routeType,
    'next.render_source': context.renderSource ?? MISSING_LABEL,
    'next.revalidate_reason': context.revalidateReason ?? MISSING_LABEL,
  };
}

export function recordRequestError(
  context: RequestErrorContext,
  counter: Counter = getErrorCounter(),
): void {
  counter.add(1, requestErrorAttributes(context));
}
