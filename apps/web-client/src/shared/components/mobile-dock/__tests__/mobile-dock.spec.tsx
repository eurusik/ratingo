import { render, screen, fireEvent } from '@testing-library/react';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockUsePathname = jest.fn<string, []>();
const mockRouterPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('lucide-react', () => ({
  Flame: () => <svg data-testid="icon-flame" />,
  Film: () => <svg data-testid="icon-film" />,
  Search: () => <svg data-testid="icon-search" />,
  Play: () => <svg data-testid="icon-play" />,
  Bookmark: () => <svg data-testid="icon-bookmark" />,
}));

const mockOpenLogin = jest.fn();
let mockIsAuthenticated = false;

jest.mock('@/core/auth', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
  useAuthModalStore: (selector: (s: { openLogin: () => void }) => unknown) =>
    selector({ openLogin: mockOpenLogin }),
}));

const mockOpenSearch = jest.fn();

jest.mock('@/shared/stores/search-dialog.store', () => ({
  useSearchDialogStore: (selector: (s: { open: () => void }) => unknown) =>
    selector({ open: mockOpenSearch }),
}));

const mockDict = {
  nav: { shows: 'Серіали', movies: 'Фільми', search: 'Пошук', calendar: 'Календар' },
  auth: { activity: 'Активність', saved: 'Збережене' },
};

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ dict: mockDict }),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { MobileDock } from '../mobile-dock';
import { MobileDockItem } from '../mobile-dock-item';

/* ------------------------------------------------------------------ */
/*  MobileDock tests                                                   */
/* ------------------------------------------------------------------ */

describe('MobileDock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    mockIsAuthenticated = false;
  });

  /* ---- Rendering ---- */

  describe('rendering', () => {
    it('renders 5 items: Shows, Movies, Search, Saved, Activity', () => {
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).toBeInTheDocument();
      expect(screen.getByText('Фільми')).toBeInTheDocument();
      expect(screen.getByText('Пошук')).toBeInTheDocument();
      expect(screen.getByText('Збережене')).toBeInTheDocument();
      expect(screen.getByText('Активність')).toBeInTheDocument();
    });

    it('renders same 5 items for authenticated users', () => {
      mockIsAuthenticated = true;
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).toBeInTheDocument();
      expect(screen.getByText('Фільми')).toBeInTheDocument();
      expect(screen.getByText('Пошук')).toBeInTheDocument();
      expect(screen.getByText('Збережене')).toBeInTheDocument();
      expect(screen.getByText('Активність')).toBeInTheDocument();
    });

    it('renders nav landmark with accessible label', () => {
      render(<MobileDock />);

      expect(
        screen.getByRole('navigation', { name: 'Mobile navigation' }),
      ).toBeInTheDocument();
    });

    it('renders all dock icons', () => {
      render(<MobileDock />);

      expect(screen.getByTestId('icon-flame')).toBeInTheDocument();
      expect(screen.getByTestId('icon-film')).toBeInTheDocument();
      expect(screen.getByTestId('icon-search')).toBeInTheDocument();
      expect(screen.getByTestId('icon-bookmark')).toBeInTheDocument();
      expect(screen.getByTestId('icon-play')).toBeInTheDocument();
    });

    it('has md:hidden CSS class for mobile-only visibility', () => {
      render(<MobileDock />);

      const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
      expect(nav).toHaveClass('md:hidden');
    });
  });

  /* ---- Active state ---- */

  describe('active state detection', () => {
    it('marks Shows tab active when pathname starts with /browse/shows', () => {
      mockUsePathname.mockReturnValue('/browse/shows-trending');
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).toHaveClass('font-medium');
    });

    it('marks Shows tab active for any /browse/shows sub-path', () => {
      mockUsePathname.mockReturnValue('/browse/shows/some-show');
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).toHaveClass('font-medium');
    });

    it('does not mark Shows tab active on /browse/movies path', () => {
      mockUsePathname.mockReturnValue('/browse/movies-trending');
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).not.toHaveClass('font-medium');
    });

    it('marks Movies tab active when pathname starts with /browse/movies', () => {
      mockUsePathname.mockReturnValue('/browse/movies-trending');
      render(<MobileDock />);

      const label = screen.getByText('Фільми');
      expect(label).toHaveClass('font-medium');
    });

    it('marks Movies tab active for any /browse/movies sub-path', () => {
      mockUsePathname.mockReturnValue('/browse/movies/some-film');
      render(<MobileDock />);

      expect(screen.getByText('Фільми')).toHaveClass('font-medium');
    });

    it('does not mark Movies tab active on /browse/shows path', () => {
      mockUsePathname.mockReturnValue('/browse/shows-trending');
      render(<MobileDock />);

      expect(screen.getByText('Фільми')).not.toHaveClass('font-medium');
    });

    it('no tab is active on the home page (guest)', () => {
      mockUsePathname.mockReturnValue('/');
      mockIsAuthenticated = false;
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).not.toHaveClass('font-medium');
      expect(screen.getByText('Фільми')).not.toHaveClass('font-medium');
      expect(screen.getByText('Збережене')).not.toHaveClass('font-medium');
      expect(screen.getByText('Активність')).not.toHaveClass('font-medium');
    });

    it('no tab is active on the home page (authenticated)', () => {
      mockUsePathname.mockReturnValue('/');
      mockIsAuthenticated = true;
      render(<MobileDock />);

      expect(screen.getByText('Серіали')).not.toHaveClass('font-medium');
      expect(screen.getByText('Фільми')).not.toHaveClass('font-medium');
      expect(screen.getByText('Збережене')).not.toHaveClass('font-medium');
      expect(screen.getByText('Активність')).not.toHaveClass('font-medium');
    });

    it('marks Saved tab active on /saved path', () => {
      mockUsePathname.mockReturnValue('/saved');
      render(<MobileDock />);

      expect(screen.getByText('Збережене')).toHaveClass('font-medium');
      expect(screen.getByRole('link', { name: /Збережене/i })).toHaveAttribute('aria-current', 'page');
    });

    it('marks Saved tab active on /saved path for authenticated users', () => {
      mockUsePathname.mockReturnValue('/saved');
      mockIsAuthenticated = true;
      render(<MobileDock />);

      expect(screen.getByText('Збережене')).toHaveClass('font-medium');
      expect(screen.getByRole('link', { name: /Збережене/i })).toHaveAttribute('aria-current', 'page');
    });
  });

  /* ---- Search tab ---- */

  describe('Search tab', () => {
    it('calls openSearch when Search tab is clicked', () => {
      render(<MobileDock />);

      fireEvent.click(screen.getByText('Пошук'));

      expect(mockOpenSearch).toHaveBeenCalledTimes(1);
    });

    it('renders Search as a button (not a link)', () => {
      render(<MobileDock />);

      const searchButton = screen.getByRole('button', { name: /Пошук/i });
      expect(searchButton).toBeInTheDocument();
    });
  });

  /* ---- Saved tab auth guard ---- */

  describe('Saved tab', () => {
    it('calls openLogin and does not navigate when user is not authenticated', () => {
      mockIsAuthenticated = false;
      render(<MobileDock />);

      fireEvent.click(screen.getByText('Збережене'));

      expect(mockOpenLogin).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('navigates to /saved when user is authenticated', () => {
      mockIsAuthenticated = true;
      render(<MobileDock />);

      fireEvent.click(screen.getByText('Збережене'));

      expect(mockOpenLogin).not.toHaveBeenCalled();
    });
  });

  /* ---- Activity tab auth guard ---- */

  describe('Activity tab', () => {
    it('calls openLogin and does not navigate when user is not authenticated', () => {
      mockIsAuthenticated = false;
      render(<MobileDock />);

      fireEvent.click(screen.getByText('Активність'));

      expect(mockOpenLogin).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('navigates to /activity when user is authenticated', () => {
      mockIsAuthenticated = true;
      render(<MobileDock />);

      fireEvent.click(screen.getByText('Активність'));

      expect(mockOpenLogin).not.toHaveBeenCalled();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  MobileDockItem tests                                               */
/* ------------------------------------------------------------------ */

describe('MobileDockItem', () => {
  const IconStub = () => <svg data-testid="item-icon" />;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ---- Rendering modes ---- */

  describe('rendering mode: button (onClick only, no href)', () => {
    it('renders a <button> element', () => {
      const onClick = jest.fn();
      render(
        <MobileDockItem icon={IconStub} label="Action" onClick={onClick} isActive={false} />,
      );

      expect(screen.getByRole('button', { name: /Action/i })).toBeInTheDocument();
    });

    it('does not render an anchor when onClick is provided without href', () => {
      const onClick = jest.fn();
      render(
        <MobileDockItem icon={IconStub} label="Action" onClick={onClick} isActive={false} />,
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('calls onClick handler when clicked', () => {
      const onClick = jest.fn();
      render(
        <MobileDockItem icon={IconStub} label="Action" onClick={onClick} isActive={false} />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Action/i }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders the icon', () => {
      render(
        <MobileDockItem icon={IconStub} label="Action" onClick={jest.fn()} isActive={false} />,
      );

      expect(screen.getByTestId('item-icon')).toBeInTheDocument();
    });

    it('renders the label text', () => {
      render(
        <MobileDockItem icon={IconStub} label="Action" onClick={jest.fn()} isActive={false} />,
      );

      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('rendering mode: Link (href only, no onBeforeNavigate)', () => {
    it('renders an anchor element with the correct href', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={false} />,
      );

      const link = screen.getByRole('link', { name: /Shows/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/browse/shows');
    });

    it('does not render a button when href is provided without onClick', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={false} />,
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders icon and label inside the link', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={false} />,
      );

      expect(screen.getByTestId('item-icon')).toBeInTheDocument();
      expect(screen.getByText('Shows')).toBeInTheDocument();
    });
  });

  describe('rendering mode: anchor with guard (href + onBeforeNavigate)', () => {
    it('renders an anchor element with the correct href', () => {
      render(
        <MobileDockItem
          icon={IconStub}
          label="Activity"
          href="/activity"
          isActive={false}
          onBeforeNavigate={() => true}
        />,
      );

      const anchor = screen.getByRole('link', { name: /Activity/i });
      expect(anchor).toBeInTheDocument();
      expect(anchor).toHaveAttribute('href', '/activity');
    });

    it('prevents navigation and does not push route when onBeforeNavigate returns false', () => {
      const onBeforeNavigate = jest.fn().mockReturnValue(false);
      render(
        <MobileDockItem
          icon={IconStub}
          label="Activity"
          href="/activity"
          isActive={false}
          onBeforeNavigate={onBeforeNavigate}
        />,
      );

      fireEvent.click(screen.getByRole('link', { name: /Activity/i }));

      expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('allows navigation when onBeforeNavigate returns true', () => {
      const onBeforeNavigate = jest.fn().mockReturnValue(true);
      render(
        <MobileDockItem
          icon={IconStub}
          label="Activity"
          href="/activity"
          isActive={false}
          onBeforeNavigate={onBeforeNavigate}
        />,
      );

      fireEvent.click(screen.getByRole('link', { name: /Activity/i }));

      expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
      // Link handles navigation natively; router.push is no longer called
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  /* ---- Active / inactive styling ---- */

  describe('active styling', () => {
    it('applies font-medium to label when isActive is true', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={true} />,
      );

      expect(screen.getByText('Shows')).toHaveClass('font-medium');
    });

    it('does not apply font-medium to label when isActive is false', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={false} />,
      );

      expect(screen.getByText('Shows')).not.toHaveClass('font-medium');
    });

    it('applies active text colour class to wrapper when isActive is true', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={true} />,
      );

      const link = screen.getByRole('link', { name: /Shows/i });
      expect(link).toHaveClass('text-cinema-text-primary');
    });

    it('applies inactive text colour class to wrapper when isActive is false', () => {
      render(
        <MobileDockItem icon={IconStub} label="Shows" href="/browse/shows" isActive={false} />,
      );

      const link = screen.getByRole('link', { name: /Shows/i });
      expect(link).toHaveClass('text-cinema-text-muted');
    });
  });

  /* ---- Null render guard ---- */

  describe('null render (no href, no onClick)', () => {
    it('renders nothing when neither href nor onClick is provided', () => {
      const { container } = render(
        <MobileDockItem icon={IconStub} label="Ghost" isActive={false} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
