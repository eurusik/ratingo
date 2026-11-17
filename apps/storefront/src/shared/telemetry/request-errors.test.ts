import type { Counter } from '@opentelemetry/api';

import { recordRequestError } from './request-errors';

describe('recordRequestError', () => {
  it('counts an error by route, route type and render source', () => {
    const add = jest.fn();
    recordRequestError(
      {
        routePath: '/app/(shell)/(details)/movie/[slug]',
        routeType: 'render',
        renderSource: 'react-server-components',
        revalidateReason: undefined,
      },
      { add } as unknown as Counter,
    );

    expect(add).toHaveBeenCalledWith(1, {
      'http.route': '/app/(shell)/(details)/movie/[slug]',
      'next.route_type': 'render',
      'next.render_source': 'react-server-components',
      'next.revalidate_reason': 'none',
    });
  });

  it('falls back to placeholders when Next.js gives no context', () => {
    const add = jest.fn();
    recordRequestError({}, { add } as unknown as Counter);

    expect(add).toHaveBeenCalledWith(1, {
      'http.route': 'unmatched',
      'next.route_type': 'unknown',
      'next.render_source': 'none',
      'next.revalidate_reason': 'none',
    });
  });
});
