import { renderHook } from '@testing-library/react';
import { useLoggedError } from './logged-error';

describe('useLoggedError', () => {
  afterEach(() => {
    delete window.gtag;
    jest.restoreAllMocks();
  });

  it('logs the error and reports a render failure under the label', () => {
    window.gtag = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('boom');

    renderHook(() => useLoggedError('Page failed to render', error));

    expect(consoleError).toHaveBeenCalledWith('Page failed to render', error);
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'app_error', {
      kind: 'render',
      area: 'Page failed to render',
    });
  });

  it('does not report the same error again on rerender', () => {
    window.gtag = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('boom');

    const { rerender } = renderHook(() => useLoggedError('Page failed to render', error));
    rerender();

    expect(window.gtag).toHaveBeenCalledTimes(1);
  });
});
