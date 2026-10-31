# image-proxy

Cloudflare Worker behind `img.ratingo.top`. It proxies TMDB (`/tmdb/<size>/<file>`) and TVMaze (`/tvmaze/...`) images and controls their caching:

- Cloudflare edge cache: 2xx for 30 days, 404 for 1 hour, 5xx not cached.
- Browsers: `public, max-age=31536000, immutable` for 2xx (TMDB and TVMaze paths never change content), `max-age=60` otherwise.

The zone `ratingo.top` has Smart Tiered Cache on, so edge locations fetch misses from each other before going to TMDB.

The web client points `NEXT_PUBLIC_IMAGE_PROXY_ORIGIN` at this worker, and the API builds image URLs from `IMAGE_PROXY_BASE_URL`.

## Deploy

Nothing deploys this automatically. Deploy changes from this folder:

```bash
npx wrangler deploy
```

This file is the source of truth: edit it here and deploy, not in the Cloudflare dashboard.
