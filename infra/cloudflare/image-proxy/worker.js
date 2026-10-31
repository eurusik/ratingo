export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    let targetUrl;
    if (path.startsWith('/tmdb/')) {
      targetUrl = 'https://image.tmdb.org/t/p/' + path.slice(6);
    } else if (path.startsWith('/tvmaze/')) {
      targetUrl = 'https://static.tvmaze.com/uploads/images/' + path.slice(8);
    } else {
      return new Response('Not found', { status: 404 });
    }

    const response = await fetch(targetUrl, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { '200-299': 2592000, 404: 3600, '500-599': 0 },
      },
      headers: {
        'User-Agent': 'Ratingo Image Proxy',
      },
    });

    const headers = new Headers(response.headers);
    headers.set(
      'Cache-Control',
      response.ok ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    );
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
