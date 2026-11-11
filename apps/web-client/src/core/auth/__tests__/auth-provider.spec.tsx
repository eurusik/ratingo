import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { toast } from 'sonner';
import { I18nProvider, type Locale } from '@/shared/i18n';
import { AuthProvider } from '../auth-provider';

const sessionProviderProps: { onSessionExpired?: () => void } = {};

jest.mock('@ratingo/web-core/auth', () => ({
  AuthProvider: ({ children, onSessionExpired }: { children: ReactNode; onSessionExpired?: () => void }) => {
    sessionProviderProps.onSessionExpired = onSessionExpired;
    return <>{children}</>;
  },
}));

jest.mock('@/core/api/client', () => ({
  configureWebClientApi: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { error: jest.fn() },
}));

function renderInLocale(locale: Locale) {
  render(
    <I18nProvider locale={locale}>
      <AuthProvider>
        <span>app</span>
      </AuthProvider>
    </I18nProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.mocked(toast.error).mockClear();
  });

  it.each([
    ['uk', 'Сесія закінчилась. Увійдіть знову.'],
    ['en', 'Your session has expired. Sign in again.'],
  ] as const)('shows the session-expired toast in %s', (locale, message) => {
    renderInLocale(locale);

    sessionProviderProps.onSessionExpired?.();

    expect(toast.error).toHaveBeenCalledWith(message);
  });
});
