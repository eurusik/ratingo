import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { PrivacySettingsPage, ProfileSettingsPage, SecuritySettingsPage } from './settings-pages';

const push = jest.fn();
const back = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, replace: jest.fn() }),
  usePathname: () => '/settings',
}));

jest.mock('@ratingo/web-core/auth', () => ({
  useAuth: jest.fn(),
  authApi: {
    getAuthConfig: jest.fn().mockResolvedValue({
      google: { enabled: true },
      facebook: { enabled: false },
    }),
    me: jest.fn(),
    unlinkProvider: jest.fn(),
  },
  tokenStorage: { getAccessToken: jest.fn() },
}));

jest.mock('@/shared/api', () => ({
  accountApi: { linkedAccounts: jest.fn().mockResolvedValue([]), updateProfile: jest.fn() },
}));

const uk = getDictionary('uk');

function userWith(
  overrides: Partial<MeDto> = {},
  privacy: Partial<MeDto['profile']['privacy']> = {},
) {
  return {
    id: 'user-1',
    email: 'ivan@example.com',
    username: 'ivan_42',
    avatarUrl: null,
    role: 'user',
    hasPassword: true,
    linkedProviders: [],
    stats: {},
    profile: {
      bio: null,
      location: null,
      website: null,
      preferredLanguage: null,
      preferredRegion: 'UA',
      privacy: {
        isProfilePublic: true,
        showWatchHistory: true,
        showRatings: true,
        allowFollowers: true,
        autoSubscribeOnWatch: true,
        ...privacy,
      },
    },
    ...overrides,
  } as MeDto;
}

function renderPage(page: ReactNode, user: MeDto) {
  jest.mocked(useAuth).mockReturnValue({
    user,
    isLoading: false,
    logout: jest.fn(),
    refreshUser: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        {page}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('settings pages', () => {
  afterEach(() => jest.clearAllMocks());

  it('keeps the other privacy switches but disables them for a private profile', () => {
    renderPage(<PrivacySettingsPage />, userWith({}, { isProfilePublic: false }));

    const copy = uk.settings.privacy;
    expect(
      screen.getByRole('switch', { name: new RegExp(copy.isProfilePublic.label) }),
    ).not.toBeChecked();
    for (const toggle of ['showWatchHistory', 'showRatings', 'allowFollowers'] as const) {
      const control = screen.getByRole('switch', { name: new RegExp(copy[toggle].label) });
      expect(control).toBeChecked();
      expect(control).toBeDisabled();
    }
    expect(screen.getByRole('status')).toHaveTextContent('ratingo.top/u/ivan_42');
  });

  it('does not let the last sign-in method go', () => {
    renderPage(
      <SecuritySettingsPage />,
      userWith({ linkedProviders: ['google'], hasPassword: false }),
    );

    const copy = uk.settings.security;
    const disconnect = screen.getByRole('button', {
      name: copy.disconnectLabel.replace('{provider}', 'Google'),
    });
    expect(disconnect).toBeDisabled();
    expect(disconnect).toHaveAccessibleDescription(copy.lastMethod);
    expect(screen.queryByRole('button', { name: copy.changePassword })).not.toBeInTheDocument();
  });

  it('asks before disconnecting a provider and names what stays', () => {
    renderPage(<SecuritySettingsPage />, userWith({ linkedProviders: ['google'] }));

    const copy = uk.settings.security;
    fireEvent.click(
      screen.getByRole('button', { name: copy.disconnectLabel.replace('{provider}', 'Google') }),
    );

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Лишиться вхід через email/)).toBeInTheDocument();
  });

  it('asks before leaving the profile with unsaved changes', () => {
    renderPage(<ProfileSettingsPage />, userWith());

    fireEvent.change(screen.getByRole('textbox', { name: uk.settings.profile.bio }), {
      target: { value: 'Серіали від HBO' },
    });
    fireEvent.click(screen.getByRole('link', { name: uk.settings.backLabel }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(uk.settings.profile.discard.title)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: uk.settings.profile.discard.confirm }),
    );
    expect(push).toHaveBeenCalledWith('/settings');
  });
});
