import { revalidatePath } from 'next/cache';
import { createRevalidateHandler } from './revalidate-handler';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

const SECRET = 'a'.repeat(40);
const mockedRevalidatePath = jest.mocked(revalidatePath);

interface FakeResponse {
  status: number;
  body: unknown;
}

function makeRequest(authorization: string | null, body: unknown): Request {
  return {
    headers: { get: (name: string) => (name === 'authorization' ? authorization : null) },
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  } as unknown as Request;
}

async function post(
  authorization: string | null,
  body: unknown,
  secret: string | undefined = SECRET,
): Promise<FakeResponse> {
  const response = await createRevalidateHandler(secret)(makeRequest(authorization, body));
  return response as unknown as FakeResponse;
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    mockedRevalidatePath.mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('revalidates the show page for a valid request', async () => {
    const response = await post(`Bearer ${SECRET}`, { type: 'show', slug: 'ted-lasso' });

    expect(response).toEqual({ status: 200, body: { revalidated: '/shows/ted-lasso' } });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/shows/ted-lasso');
  });

  it('revalidates the movie page for a valid request', async () => {
    await post(`Bearer ${SECRET}`, { type: 'movie', slug: 'dune-part-two' });

    expect(mockedRevalidatePath).toHaveBeenCalledWith('/movies/dune-part-two');
  });

  it('rejects a wrong secret', async () => {
    const response = await post(`Bearer ${'b'.repeat(40)}`, { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(401);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a secret of a different length', async () => {
    const response = await post(`Bearer ${SECRET}x`, { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(401);
  });

  it('rejects a missing authorization header', async () => {
    const response = await post(null, { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(401);
  });

  it('rejects every request when the secret is not configured', async () => {
    const response = await post('Bearer ', { type: 'show', slug: 'ted-lasso' }, undefined);

    expect(response.status).toBe(401);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown type', { type: 'journal', slug: 'post' }],
    ['a path-like slug', { type: 'show', slug: '../admin' }],
    ['an uppercase slug', { type: 'show', slug: 'Ted-Lasso' }],
    ['a prototype key as type', { type: 'toString', slug: 'ted-lasso' }],
    ['a missing body', undefined],
  ])('rejects %s', async (_label, body) => {
    const response = await post(`Bearer ${SECRET}`, body);

    expect(response.status).toBe(400);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      'Revalidation rejected an invalid payload',
      body ?? null,
    );
  });
});
