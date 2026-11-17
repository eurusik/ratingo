import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { CancelledError, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@ratingo/web-core/api';
import { ApiErrorReporter } from './api-error-reporter';

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <ApiErrorReporter />
      {children}
    </QueryClientProvider>
  );
  const view = render(wrap(null));
  return { queryClient, view };
}

async function settle(promise: Promise<unknown>) {
  await act(async () => {
    await promise.catch(() => undefined);
  });
}

describe('ApiErrorReporter', () => {
  beforeEach(() => {
    window.gtag = jest.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('reports a failed mutation once with its area, status and code', async () => {
    const { queryClient } = setup();

    await settle(
      queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationKey: ['library', 'save', 'extra'],
          mutationFn: () => Promise.reject(new ApiError('RATE_LIMITED', 429, 'secret message')),
        })
        .execute(undefined),
    );

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'app_error', {
      kind: 'mutation',
      area: 'library.save',
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('reports a mutation without a key under the unknown area', async () => {
    const { queryClient } = setup();

    await settle(
      queryClient
        .getMutationCache()
        .build(queryClient, { mutationFn: () => Promise.reject(new Error('offline')) })
        .execute(undefined),
    );

    expect(window.gtag).toHaveBeenCalledWith('event', 'app_error', {
      kind: 'mutation',
      area: 'unknown',
    });
  });

  it('reports a failed query once, even when it is retried', async () => {
    const { queryClient } = setup();
    const queryFn = jest.fn().mockRejectedValue(new ApiError('SHOW_NOT_FOUND', 404, 'missing'));

    await settle(
      queryClient.fetchQuery({
        queryKey: ['catalog', 'show', 'andor'],
        queryFn,
        retry: 2,
        retryDelay: 0,
      }),
    );

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'app_error', {
      kind: 'query',
      area: 'catalog.show',
      status: 404,
      code: 'SHOW_NOT_FOUND',
    });
  });

  it('ignores unauthorized responses', async () => {
    const { queryClient } = setup();

    await settle(
      queryClient.fetchQuery({
        queryKey: ['me'],
        queryFn: () => Promise.reject(new ApiError('UNAUTHORIZED', 401, 'no')),
      }),
    );
    await settle(
      queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationKey: ['library', 'save'],
          mutationFn: () => Promise.reject(new ApiError('UNAUTHORIZED', 401, 'no')),
        })
        .execute(undefined),
    );

    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('ignores aborted requests', async () => {
    const { queryClient } = setup();
    const abort = new Error('aborted');
    abort.name = 'AbortError';

    await settle(queryClient.fetchQuery({ queryKey: ['a'], queryFn: () => Promise.reject(abort) }));
    await settle(
      queryClient.fetchQuery({
        queryKey: ['b'],
        queryFn: () => Promise.reject(new CancelledError()),
      }),
    );

    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('reports nothing for successful requests', async () => {
    const { queryClient } = setup();

    await settle(queryClient.fetchQuery({ queryKey: ['ok'], queryFn: () => Promise.resolve(1) }));
    await settle(
      queryClient
        .getMutationCache()
        .build(queryClient, { mutationKey: ['ok'], mutationFn: () => Promise.resolve(1) })
        .execute(undefined),
    );

    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('stops reporting once unmounted', async () => {
    const { queryClient, view } = setup();
    view.unmount();

    await settle(
      queryClient.fetchQuery({
        queryKey: ['late'],
        queryFn: () => Promise.reject(new ApiError('INTERNAL_ERROR', 500, 'x')),
      }),
    );

    expect(window.gtag).not.toHaveBeenCalled();
  });
});
