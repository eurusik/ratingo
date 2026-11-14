import { apiGet, apiGetOrNull } from '@ratingo/web-core/api';
import { reviewsApi, type Review } from './reviews';

jest.mock('@ratingo/web-core/api', () => ({
  apiGet: jest.fn(),
  apiGetOrNull: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

describe('reviewsApi.getMine', () => {
  it('reads a missing review as null without asking for details', async () => {
    jest.mocked(apiGetOrNull).mockResolvedValue(null);

    await expect(reviewsApi.getMine('dune-id')).resolves.toBeNull();
    expect(apiGetOrNull).toHaveBeenCalledWith('me/reviews/media/dune-id');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('loads the full review when the viewer has one', async () => {
    const review = { id: 'mine' } as Review;
    jest.mocked(apiGetOrNull).mockResolvedValue({ id: 'mine' });
    jest.mocked(apiGet).mockResolvedValue(review);

    await expect(reviewsApi.getMine('dune-id')).resolves.toBe(review);
    expect(apiGet).toHaveBeenCalledWith('reviews/mine');
  });
});
