jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

import { revalidatePath } from 'next/cache';
import { POST } from '../route';

const SECRET = 'a'.repeat(40);
const mockRevalidatePath = revalidatePath as jest.Mock;

function makeRequest(authorization: string | null, body: unknown): Request {
  return {
    headers: { get: (name: string) => (name === 'authorization' ? authorization : null) },
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  } as unknown as Request;
}

async function post(authorization: string | null, body: unknown) {
  return (await POST(makeRequest(authorization, body))) as unknown as {
    status: number;
    body: unknown;
  };
}

describe('POST /api/revalidate', () => {
  const originalSecret = process.env.REVALIDATE_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REVALIDATE_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.REVALIDATE_SECRET = originalSecret;
  });

  it('revalidates the show page for a valid request', async () => {
    const response = await post(`Bearer ${SECRET}`, { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/shows/ted-lasso');
  });

  it('revalidates the movie page for a valid request', async () => {
    await post(`Bearer ${SECRET}`, { type: 'movie', slug: 'dune-part-two' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/movies/dune-part-two');
  });

  it('rejects a wrong secret', async () => {
    const response = await post(`Bearer ${'b'.repeat(40)}`, { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(401);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a missing authorization header', async () => {
    const response = await post(null, { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(401);
  });

  it('rejects every request when the secret is not configured', async () => {
    delete process.env.REVALIDATE_SECRET;

    const response = await post('Bearer ', { type: 'show', slug: 'ted-lasso' });

    expect(response.status).toBe(401);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
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
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
