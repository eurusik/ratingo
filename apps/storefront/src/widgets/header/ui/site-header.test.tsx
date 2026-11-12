import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { openSearch } from '@/features/search';
import { notificationsApi } from '@/shared/api';
import { closeAuth, useAuthRequest } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { SiteHeader } from './site-header';

let pathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/search', () => ({
  openSearch: jest.fn(),
  SearchShortcutKbd: () => <kbd>⌘K</kbd>,
}));
jest.mock('@/shared/api', () => ({
  notificationsApi: { list: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn() },
}));

const uk = getDictionary('uk');

const USER = {
  username: 'ivan_42',
  email: 'ivan@example.com',
  avatarUrl: null,
  stats: { moviesRated: 42, showsRated: 18, watchlistCount: 77 },
} as MeDto;

function mockSession(user: MeDto | null) {
  jest.mocked(useAuth).mockReturnValue({
    user,
    isLoading: false,
    isAdmin: false,
    logout: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function AuthRequestProbe() {
  const request = useAuthRequest();
  return request ? <output>{request.mode}</output> : null;
}

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        <SiteHeader />
        <AuthRequestProbe />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('SiteHeader', () => {
  beforeEach(() => {
    pathname = '/';
    jest
      .mocked(notificationsApi.list)
      .mockResolvedValue({ data: [], unreadCount: 2, total: 2, hasMore: false });
  });

  afterEach(() => {
    act(() => closeAuth());
    jest.clearAllMocks();
  });

  it('marks the current section and opens search from the header field', () => {
    mockSession(null);
    pathname = '/calendar';
    renderHeader();

    const navigation = screen.getByRole('navigation', { name: uk.nav.label });
    expect(within(navigation).getByRole('link', { name: uk.nav.calendar })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(screen.getByRole('button', { name: new RegExp(uk.search.trigger) }));
    expect(openSearch).toHaveBeenCalledTimes(1);
  });

  it('lets a guest open sign-in', () => {
    mockSession(null);
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: uk.header.signIn }));

    expect(screen.getByRole('status')).toHaveTextContent('login');
  });

  it('shows the bell with an unread dot and the profile for a signed-in user', async () => {
    mockSession(USER);
    renderHeader();

    expect(
      await screen.findByRole('button', { name: 'Сповіщення, непрочитаних: 2' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uk.header.profile })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: uk.header.signIn })).not.toBeInTheDocument();
  });

  it('keeps the phone header clean outside Today and My', () => {
    mockSession(USER);
    pathname = '/browse';
    renderHeader();

    const accountControls = screen.getByRole('button', { name: uk.header.profile }).parentElement;
    expect(accountControls).toHaveClass('hidden', 'md:flex');
  });
});
