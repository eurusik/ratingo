import { render, screen } from '@testing-library/react';
import { Header } from '../header';
import { HeaderContextProvider } from '../header-context';
import { I18nProvider } from '@/shared/i18n';

// Mock useScrollPosition hook
const mockUseScrollPosition = jest.fn(() => false);
jest.mock('@/shared/hooks', () => ({
  useScrollPosition: () => mockUseScrollPosition(),
}));

// Mock child components to isolate header logic
jest.mock('../user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

jest.mock('../search', () => ({
  SearchCommand: () => <div data-testid="search-command">Search</div>,
}));

jest.mock('../notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

jest.mock('../header-nav-button', () => ({
  HeaderNavButton: ({ label, href }: { label: string; href: string }) => (
    <a data-testid={`header-nav-${href.slice(1)}`} href={href}>
      {label}
    </a>
  ),
}));

const renderHeader = () => {
  return render(
    <I18nProvider locale="uk">
      <HeaderContextProvider>
        <Header />
      </HeaderContextProvider>
    </I18nProvider>,
  );
};

describe('Header', () => {
  beforeEach(() => {
    mockUseScrollPosition.mockReturnValue(false);
  });

  describe('structure', () => {
    it('renders header element with correct role', () => {
      renderHeader();
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('renders logo link to home', () => {
      renderHeader();
      const logoLink = screen.getByRole('link', { name: /ratingo/i });
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('renders main navigation with aria-label', () => {
      renderHeader();
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });

    it('renders all nav links', () => {
      renderHeader();
      expect(screen.getByRole('link', { name: /серіали/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /фільми/i })).toBeInTheDocument();
    });

    it('renders search, notifications, and user menu', () => {
      renderHeader();
      expect(screen.getByTestId('search-command')).toBeInTheDocument();
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    });

    it('renders saved and activity nav buttons', () => {
      renderHeader();
      expect(screen.getByTestId('header-nav-saved')).toBeInTheDocument();
      expect(screen.getByTestId('header-nav-activity')).toBeInTheDocument();
    });
  });

  describe('scroll behavior', () => {
    it('has transparent background when not scrolled', () => {
      mockUseScrollPosition.mockReturnValue(false);
      renderHeader();

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-transparent');
      expect(header).not.toHaveClass('backdrop-blur-sm');
    });

    it('has frosted glass effect when scrolled', () => {
      mockUseScrollPosition.mockReturnValue(true);
      renderHeader();

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('backdrop-blur-md');
      expect(header).toHaveClass('border-b');
    });
  });

  describe('nav links', () => {
    it('links to correct routes', () => {
      renderHeader();

      expect(screen.getByRole('link', { name: /фільми/i })).toHaveAttribute(
        'href',
        '/browse/movies-trending',
      );
      expect(screen.getByRole('link', { name: /серіали/i })).toHaveAttribute(
        'href',
        '/browse/shows-trending',
      );
    });
  });
});
