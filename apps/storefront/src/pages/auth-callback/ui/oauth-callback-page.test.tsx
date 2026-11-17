import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ratingo/web-core/api';
import { authApi, tokenStorage } from '@ratingo/web-core/auth';
import type { OAuthProvider } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { replaceDocumentLocation } from '@/shared/lib';
import { OAuthCallbackPage } from './oauth-callback-page';

let searchParams = new URLSearchParams();
let provider: OAuthProvider = 'google';

jest.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

jest.mock('@/shared/lib', () => ({
  ...jest.requireActual('@/shared/lib'),
  replaceDocumentLocation: jest.fn(),
  useBrowserOrigin: () => 'https://ratingo.test',
}));

const uk = getDictionary('uk');
const STORED_TOKENS = { accessToken: 'access', refreshToken: 'refresh' };

function callbackTree() {
  return (
    <StrictMode>
      <I18nProvider locale="uk" dictionary={uk}>
        <OAuthCallbackPage provider={provider} />
      </I18nProvider>
    </StrictMode>
  );
}

function renderCallback(query: string, nextProvider: OAuthProvider = 'google') {
  searchParams = new URLSearchParams(query);
  provider = nextProvider;
  return render(callbackTree());
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.mocked(replaceDocumentLocation).mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('exchanges the code once, stores the tokens and returns to the requested page', async () => {
    const exchange = jest.spyOn(authApi, 'exchangeOAuthCode').mockResolvedValue(STORED_TOKENS);

    renderCallback('code=one-time&returnTo=%2Fsaved%3Ftab%3Dwatchlist');

    expect(screen.getByRole('status')).toHaveTextContent(uk.oauth.completing);
    expect(screen.getByRole('status')).toHaveTextContent('Google');
    await waitFor(() =>
      expect(replaceDocumentLocation).toHaveBeenCalledWith('/saved?tab=watchlist'),
    );
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith('one-time');
    expect(tokenStorage.getAccessToken()).toBe('access');
    expect(tokenStorage.getRefreshToken()).toBe('refresh');
  });

  it('reports the provider login before leaving the page, and nothing on failure', async () => {
    window.gtag = jest.fn();
    jest.spyOn(authApi, 'exchangeOAuthCode').mockResolvedValue(STORED_TOKENS);

    renderCallback('code=one-time', 'facebook');

    await waitFor(() => expect(replaceDocumentLocation).toHaveBeenCalled());
    expect(window.gtag).toHaveBeenCalledWith('event', 'login', { method: 'facebook' });
  });

  it('reports a provider error once, with the provider and the error code', () => {
    window.gtag = jest.fn();

    const { rerender } = renderCallback('error=OAUTH_CANCELLED', 'facebook');
    rerender(callbackTree());

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'login_failed', {
      method: 'facebook',
      reason: 'OAUTH_CANCELLED',
    });
  });

  it('reports a failed code exchange with the API error code, once', async () => {
    window.gtag = jest.fn();
    jest
      .spyOn(authApi, 'exchangeOAuthCode')
      .mockRejectedValue(new ApiError('OAUTH_EXCHANGE_USED', 400, 'used'));

    renderCallback('code=reused');

    await screen.findByRole('alert');
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'login_failed', {
      method: 'google',
      reason: 'OAUTH_EXCHANGE_USED',
    });
  });

  it('reports an unknown reason when the exchange fails without an API error', async () => {
    window.gtag = jest.fn();
    jest.spyOn(authApi, 'exchangeOAuthCode').mockRejectedValue(new Error('offline'));

    renderCallback('code=lost');

    await screen.findByRole('alert');
    expect(window.gtag).toHaveBeenCalledWith('event', 'login_failed', {
      method: 'google',
      reason: 'UNKNOWN',
    });
  });

  it('does not report a successful exchange as a failure', async () => {
    window.gtag = jest.fn();
    jest.spyOn(authApi, 'exchangeOAuthCode').mockResolvedValue(STORED_TOKENS);

    renderCallback('code=one-time');

    await waitFor(() => expect(replaceDocumentLocation).toHaveBeenCalled());
    expect(window.gtag).not.toHaveBeenCalledWith('event', 'login_failed', expect.anything());
  });

  it('never sends the user to another origin', async () => {
    jest.spyOn(authApi, 'exchangeOAuthCode').mockResolvedValue(STORED_TOKENS);

    renderCallback('code=one-time&returnTo=%2F%2Fevil.example');

    await waitFor(() => expect(replaceDocumentLocation).toHaveBeenCalledWith('/'));
  });

  it('shows a calm cancelled state with retry and a way back', () => {
    const exchange = jest.spyOn(authApi, 'exchangeOAuthCode');

    renderCallback('error=OAUTH_CANCELLED', 'facebook');

    expect(screen.getByRole('heading', { name: uk.oauth.cancelledTitle })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(uk.oauth.errors.cancelled)).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.oauth.retry })).toHaveAttribute(
      'href',
      expect.stringContaining('/auth/facebook?'),
    );
    expect(screen.getByRole('link', { name: uk.oauth.backHome })).toHaveAttribute('href', '/');
    expect(exchange).not.toHaveBeenCalled();
  });

  it('retries with the same provider and returns to the original page', () => {
    renderCallback('error=OAUTH_PROVIDER_ERROR&returnTo=%2Fcalendar');

    expect(screen.getByRole('heading', { name: uk.oauth.failed })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(uk.oauth.errors.providerError);
    const retryUrl = new URL(
      screen.getByRole('link', { name: uk.oauth.retry }).getAttribute('href') ?? '',
    );
    expect(retryUrl.pathname).toMatch(/\/auth\/google$/);
    expect(retryUrl.searchParams.get('returnTo')).toBe('/calendar');
    expect(retryUrl.searchParams.get('returnOrigin')).toBe('https://ratingo.test');
    expect(screen.getByRole('link', { name: uk.oauth.back })).toHaveAttribute('href', '/calendar');
  });

  it('offers password sign-in instead of a retry when the email already has an account', () => {
    renderCallback('error=OAUTH_ACCOUNT_EXISTS_PASSWORD&returnTo=%2Fsaved');

    expect(screen.queryByRole('link', { name: uk.oauth.retry })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.oauth.signInWithPassword })).toHaveAttribute(
      'href',
      '/saved',
    );
  });

  it('treats a missing code as an expired sign-in', () => {
    renderCallback('');

    expect(screen.getByRole('alert')).toHaveTextContent(uk.oauth.errors.exchangeExpired);
  });

  it('shows the exchange error from the API', async () => {
    jest
      .spyOn(authApi, 'exchangeOAuthCode')
      .mockRejectedValue(new ApiError('OAUTH_EXCHANGE_USED', 400, 'used'));

    renderCallback('code=reused');

    expect(await screen.findByRole('alert')).toHaveTextContent(uk.oauth.errors.exchangeUsed);
    expect(replaceDocumentLocation).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for unknown failures', async () => {
    jest.spyOn(authApi, 'exchangeOAuthCode').mockRejectedValue(new TypeError('Failed to fetch'));

    renderCallback('code=offline');

    expect(await screen.findByRole('alert')).toHaveTextContent(uk.oauth.errors.unknown);
  });

  it('exchanges a new code that arrives while the page stays mounted', async () => {
    const exchange = jest
      .spyOn(authApi, 'exchangeOAuthCode')
      .mockRejectedValueOnce(new ApiError('OAUTH_EXCHANGE_EXPIRED', 400, 'expired'))
      .mockResolvedValueOnce(STORED_TOKENS);

    const { rerender } = renderCallback('code=stale');
    expect(await screen.findByRole('alert')).toHaveTextContent(uk.oauth.errors.exchangeExpired);

    searchParams = new URLSearchParams('code=fresh&returnTo=%2Fcalendar');
    rerender(callbackTree());

    expect(screen.getByRole('status')).toHaveTextContent(uk.oauth.completing);
    await waitFor(() => expect(replaceDocumentLocation).toHaveBeenCalledWith('/calendar'));
    expect(exchange).toHaveBeenNthCalledWith(2, 'fresh');
  });
});
