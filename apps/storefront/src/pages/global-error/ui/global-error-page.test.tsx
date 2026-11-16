import { fireEvent, render, screen } from '@testing-library/react';
import { GLOBAL_ERROR_COPY } from '../model/global-error-copy';
import { GlobalErrorPage } from './global-error-page';

const reloadPage = jest.fn();

describe('GlobalErrorPage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadPage },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('explains the failure in the browser language and reloads the page', () => {
    jest.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-GB');
    render(<GlobalErrorPage digest="8f3a2c1d" />, { container: document });

    expect(screen.getByRole('heading', { name: GLOBAL_ERROR_COPY.en.title })).toBeInTheDocument();
    expect(screen.getByText(`${GLOBAL_ERROR_COPY.en.errorCode} 8f3a2c1d`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: GLOBAL_ERROR_COPY.en.reload }));
    expect(reloadPage).toHaveBeenCalled();
  });

  it('speaks Ukrainian to everyone else and hides the code when there is none', () => {
    jest.spyOn(window.navigator, 'language', 'get').mockReturnValue('uk-UA');
    render(<GlobalErrorPage />, { container: document });

    expect(screen.getByRole('heading', { name: GLOBAL_ERROR_COPY.uk.title })).toBeInTheDocument();
    expect(screen.queryByText(GLOBAL_ERROR_COPY.uk.errorCode, { exact: false })).toBeNull();
  });
});
