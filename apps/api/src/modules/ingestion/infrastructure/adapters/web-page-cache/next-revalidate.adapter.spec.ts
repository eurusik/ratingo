const mockPost = jest.fn();

jest.mock('@/common/http/resilient-http.client', () => ({
  ResilientHttpClient: class {
    post = mockPost;
  },
}));

import { MediaType } from '@/common/enums/media-type.enum';
import { ExternalApiException } from '@/common/exceptions/external-api.exception';

import { NextRevalidateAdapter } from './next-revalidate.adapter';

const SECRET = 's'.repeat(40);
const URL = 'https://ratingo.top/api/revalidate';

function createAdapter(config: { url: string | null; secret: string | null }) {
  return new NextRevalidateAdapter(config);
}

describe('NextRevalidateAdapter', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts the media type and slug with the bearer secret', async () => {
    mockPost.mockResolvedValue({ success: true, data: {}, attempts: 1 });

    await createAdapter({ url: URL, secret: SECRET }).invalidateMediaPage(
      MediaType.SHOW,
      'ted-lasso',
    );

    expect(mockPost).toHaveBeenCalledWith(
      URL,
      { type: 'show', slug: 'ted-lasso' },
      { Authorization: `Bearer ${SECRET}` },
    );
  });

  it.each([
    ['the URL', { url: null, secret: SECRET }],
    ['the secret', { url: URL, secret: null }],
  ])('does nothing when %s is not configured', async (_label, config) => {
    await createAdapter(config).invalidateMediaPage(MediaType.MOVIE, 'dune');

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('throws ExternalApiException when the web app rejects the call', async () => {
    mockPost.mockResolvedValue({
      success: false,
      data: null,
      attempts: 1,
      error: new Error('401 Unauthorized'),
    });

    await expect(
      createAdapter({ url: URL, secret: SECRET }).invalidateMediaPage(MediaType.MOVIE, 'dune'),
    ).rejects.toBeInstanceOf(ExternalApiException);
  });
});
