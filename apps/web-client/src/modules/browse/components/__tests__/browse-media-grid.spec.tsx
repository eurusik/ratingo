import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowseMediaGrid } from '../browse-media-grid';
import type { MediaCardServerProps } from '@/modules/home';

jest.mock('@/core/auth', () => ({
  useAuth: jest.fn(() => ({ isAuthenticated: true })),
}));

jest.mock('@/core/api/user-actions.client', () => ({
  userActionsApi: {
    getBatchSaveStatus: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/modules/home', () => ({
  MediaCardServer: ({ id, title }: { id: string; title: string }) => (
    <div data-testid={`card-${id}`}>{title}</div>
  ),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithQueryClient(ui: React.ReactElement, queryClient: QueryClient) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockItems: MediaCardServerProps[] = [
  { id: 'movie-1', slug: 'movie-1', type: 'movie', title: 'Movie One' },
  { id: 'movie-2', slug: 'movie-2', type: 'movie', title: 'Movie Two' },
  { id: 'show-1', slug: 'show-1', type: 'show', title: 'Show One' },
];

describe('BrowseMediaGrid', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders all media cards', () => {
    renderWithQueryClient(<BrowseMediaGrid items={mockItems} />, queryClient);

    expect(screen.getByTestId('card-movie-1')).toBeInTheDocument();
    expect(screen.getByTestId('card-movie-2')).toBeInTheDocument();
    expect(screen.getByTestId('card-show-1')).toBeInTheDocument();
  });

  it('renders nothing when items array is empty', () => {
    const { container } = renderWithQueryClient(<BrowseMediaGrid items={[]} />, queryClient);

    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    renderWithQueryClient(
      <BrowseMediaGrid items={mockItems} className="custom-class" />,
      queryClient,
    );

    const grid = screen.getByTestId('card-movie-1').parentElement;
    expect(grid).toHaveClass('custom-class');
  });

  it('renders responsive grid with correct classes', () => {
    renderWithQueryClient(<BrowseMediaGrid items={mockItems} />, queryClient);

    const grid = screen.getByTestId('card-movie-1').parentElement;
    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveClass('sm:grid-cols-3');
    expect(grid).toHaveClass('md:grid-cols-4');
    expect(grid).toHaveClass('lg:grid-cols-5');
    expect(grid).toHaveClass('xl:grid-cols-6');
  });

  it('fetches batch save status for all items', async () => {
    const { userActionsApi } = await import('@/core/api/user-actions.client');
    const mockGetBatchSaveStatus = userActionsApi.getBatchSaveStatus as jest.Mock;
    mockGetBatchSaveStatus.mockClear();

    renderWithQueryClient(<BrowseMediaGrid items={mockItems} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockGetBatchSaveStatus).toHaveBeenCalledWith(['movie-1', 'movie-2', 'show-1']);
  });
});
