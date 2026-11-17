import { type Counter, metrics } from '@opentelemetry/api';

import { METER_NAME, REQUEST_ERRORS_METRIC, UNMATCHED_ROUTE } from './constants';

export interface RequestErrorContext {
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
}

let counter: Counter | undefined;

const errorCounter = (): Counter => {
  counter ??= metrics.getMeter(METER_NAME).createCounter(REQUEST_ERRORS_METRIC, {
    description: 'Errors captured by the Next.js onRequestError hook',
  });
  return counter;
};

function requestErrorAttributes(context: RequestErrorContext) {
  return {
    'http.route': context.routePath || UNMATCHED_ROUTE,
    'next.route_type': context.routeType ?? 'unknown',
    'next.render_source': context.renderSource ?? 'none',
    'next.revalidate_reason': context.revalidateReason ?? 'none',
  };
}

export function recordRequestError(context: RequestErrorContext, target: Counter = errorCounter()): void {
  target.add(1, requestErrorAttributes(context));
}
