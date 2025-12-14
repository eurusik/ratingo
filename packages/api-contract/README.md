# @ratingo/api-contract

This package is the single source of truth for the **API contract** in the monorepo.

It contains:

- `openapi.json` (generated)
- `src/api-types.ts` (generated via `openapi-typescript`)

You should **not edit generated files manually**.

## Install / Dependency

In this monorepo, `web app` depends on this package via workspaces.

## Update the contract

Run from the repo root:

```bash
npm run contracts:update
```

This does:

- Generate `packages/api-contract/openapi.json` from `apps/api`
- Generate `packages/api-contract/src/api-types.ts` from `openapi.json`

## Import types

```ts
import type { components, paths } from '@ratingo/api-contract';
```

Useful shortcuts:

- `components["schemas"]["SomeDto"]` – schema/DTO types
- `paths["/api/..."].get` – operation type for a specific method

Recommended helpers (to avoid long index chains):

```ts
import type { GetData, GetJson, GetPath, GetQuery } from '@ratingo/api-contract';
```

Recommended pattern (best DX):

```ts
import type { GetPath } from '@ratingo/api-contract';

const TRENDING_MOVIES_PATH = '/api/catalog/movies/trending' satisfies GetPath;
```

## Response wrapper (important)

The API returns successful responses in the standardized shape:

```ts
{ success: true, data: ... }
```

The generated OpenAPI and TypeScript types **match this runtime format**.

## Example 1: Type a response body for a known endpoint

```ts
import type { GetJson, GetPath } from '@ratingo/api-contract';

const TRENDING_MOVIES_PATH = '/api/catalog/movies/trending' satisfies GetPath;

type TrendingMoviesResponse = GetJson<typeof TRENDING_MOVIES_PATH>;

// TrendingMoviesResponse is:
// { success: true; data: PaginatedMovieResponseDto }
```

## Example 2: Extract the DTO from the wrapper

```ts
import type { GetData, GetPath } from '@ratingo/api-contract';

const TRENDING_MOVIES_PATH = '/api/catalog/movies/trending' satisfies GetPath;

type TrendingMoviesDto = GetData<typeof TRENDING_MOVIES_PATH>;
```

## Example 3: Type query params for an endpoint

```ts
import type { GetPath, GetQuery } from '@ratingo/api-contract';

const TRENDING_MOVIES_PATH = '/api/catalog/movies/trending' satisfies GetPath;

type TrendingMoviesQuery = GetQuery<typeof TRENDING_MOVIES_PATH>;

// Example usage
const query: TrendingMoviesQuery = {
  limit: 20,
  sort: 'popularity',
  order: 'desc',
  genres: 'action,comedy',
};
```

## Example 4: Minimal typed fetch helper

This is a small pattern you can use in `apps/web` to make typed calls.

```ts
type ApiSuccess<T> = { success: true; data: T };

type FetchJsonOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
};

async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

// Usage
import type { GetData, GetJson, GetPath } from '@ratingo/api-contract';

const TRENDING_MOVIES_PATH = '/api/catalog/movies/trending' satisfies GetPath;

type TrendingMoviesResponse = GetJson<typeof TRENDING_MOVIES_PATH>;
type TrendingMoviesDto = GetData<typeof TRENDING_MOVIES_PATH>;

async function getTrendingMovies(baseUrl: string): Promise<TrendingMoviesDto> {
  const res = await fetchJson<TrendingMoviesResponse>(`${baseUrl}${TRENDING_MOVIES_PATH}`);
  return res.data;
}
```

## Example 5: PATCH endpoint (request + response types)

```ts
import type { PatchBody, PatchData, PatchPath } from '@ratingo/api-contract';

const UPDATE_PROFILE_PATH = '/api/users/me' satisfies PatchPath;

type UpdateProfileBody = PatchBody<typeof UPDATE_PROFILE_PATH>;
type UpdateProfileDto = PatchData<typeof UPDATE_PROFILE_PATH>;
```

## Example 6: POST endpoint (request + response types)

```ts
import type { PostBody, PostData, PostPath } from '@ratingo/api-contract';

const LOGIN_PATH = '/api/auth/login' satisfies PostPath;

type LoginBody = PostBody<typeof LOGIN_PATH>;
type LoginDto = PostData<typeof LOGIN_PATH>;
```

## Example 7: POST 204 No Content

```ts
import type { PostNoContent, PostPath } from '@ratingo/api-contract';

const LOGOUT_PATH = '/api/auth/logout' satisfies PostPath;

type LogoutResult = PostNoContent<typeof LOGOUT_PATH>; // void

async function logout(baseUrl: string): Promise<LogoutResult> {
  const res = await fetch(`${baseUrl}${LOGOUT_PATH}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return;
}
```

## Example 8: DELETE 204 No Content (template)

At the moment there are no `DELETE` endpoints in the current OpenAPI contract.
When you add one and regenerate contracts, use this pattern:

```ts
import type { DeleteNoContent, DeletePath } from '@ratingo/api-contract';

const DELETE_SOMETHING_PATH = '/api/replace/me' satisfies DeletePath;

type DeleteResult = DeleteNoContent<typeof DELETE_SOMETHING_PATH>; // void
```

## Troubleshooting

- If `openapi.json` or `api-types.ts` looks outdated, re-run `npm run contracts:update`.
- If you add/change DTOs/controllers in the API, regenerate the contract before using new types in the frontend.
