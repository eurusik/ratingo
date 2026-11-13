import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { OwnScoreChip } from './own-score-chip';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({ libraryApi: { getRatings: jest.fn() } }));

function renderScores(ids: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {ids.map((id) => (
          <OwnScoreChip key={id} mediaItemId={id} />
        ))}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('OwnScoreChip', () => {
  beforeEach(() => jest.mocked(libraryApi.getRatings).mockReset());

  it('shows the signed-in user’s own score, loaded in one batch', async () => {
    jest.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as ReturnType<typeof useAuth>);
    jest.mocked(libraryApi.getRatings).mockResolvedValue({ 'media-1': 85 });

    renderScores(['media-1', 'media-2']);

    expect(await screen.findByText('Твоя оцінка 8,5')).toBeInTheDocument();
    expect(screen.getAllByText(/Твоя оцінка/)).toHaveLength(1);
    expect(libraryApi.getRatings).toHaveBeenCalledWith(['media-1', 'media-2']);
  });

  it('stays hidden for a guest', () => {
    jest.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuth>);
    renderScores(['media-1']);
    expect(screen.queryByText(/Твоя оцінка/)).not.toBeInTheDocument();
    expect(libraryApi.getRatings).not.toHaveBeenCalled();
  });
});
