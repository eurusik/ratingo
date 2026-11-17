import { render } from '@testing-library/react';
import { NotFoundReporter } from './not-found-reporter';

describe('NotFoundReporter', () => {
  afterEach(() => {
    delete window.gtag;
  });

  it('reports a missing page once on mount and stays quiet on rerender', () => {
    window.gtag = jest.fn();

    const { rerender } = render(<NotFoundReporter />);
    rerender(<NotFoundReporter />);

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'app_error', {
      kind: 'not_found',
      area: 'page',
    });
  });
});
