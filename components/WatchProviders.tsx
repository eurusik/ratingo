'use client';

import Image from 'next/image';

interface WatchProvider {
  id: number;
  name: string;
  provider_name?: string;
  logo_path?: string | null;
  region?: string | null;
  category?: string | null;
  rank?: number | null;
  link_url?: string | null;
}

interface WatchProvidersProps {
  providers: WatchProvider[];
  showTitle: string;
  imdbId?: string | null;
  compact?: boolean;
  region?: string | null;
}

export function WatchProviders({ providers, showTitle, imdbId, compact = false, region = null }: WatchProvidersProps) {
  if (!providers || providers.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">🚫</div>
        <div className="text-gray-400 text-sm">Немає даних про провайдерів</div>
      </div>
    );
  }

  // Canonicalize names to avoid duplicates like "Paramount+ ..." vs "Paramount Plus"
  const canonicalize = (rawName: string) => {
    const name = (rawName || '').trim();
    const n = name.toLowerCase();
    if (n.includes('paramount')) return { key: 'paramount-plus', label: 'Paramount Plus' };
    if (n.includes('hbo max') || n === 'max') return { key: 'max', label: 'Max' };
    if (n.includes('amazon') && (n.includes('prime') || n.includes('video'))) return { key: 'amazon-prime-video', label: 'Amazon Prime Video' };
    if (n.includes('apple tv')) return { key: 'apple-tv', label: 'Apple TV' };
    if (n.includes('disney')) return { key: 'disney-plus', label: 'Disney Plus' };
    if (n.includes('hulu')) return { key: 'hulu', label: 'Hulu' };
    if (n.includes('google play')) return { key: 'google-play', label: 'Google Play' };
    if (n.includes('netflix')) return { key: 'netflix', label: 'Netflix' };
    return { key: name.toLowerCase().replace(/\s+/g, '-'), label: name };
  };

  // Prefer flatrate/free/ads; skip rent/buy by default
  const isPreferredCategory = (c?: string | null) => {
    const cat = (c || '').toLowerCase();
    return cat === 'flatrate' || cat === 'free' || cat === 'ads' || cat === '';
  };

  // Filter by region if provided
  const regionFiltered = region ? providers.filter(p => p.region === region) : providers;

  // Dedupe by canonical key, keeping best category and lowest rank
  const byKey = new Map<string, WatchProvider & { _label?: string }>();
  const catScore = (c?: string | null) => {
    const cat = (c || '').toLowerCase();
    if (cat === 'flatrate') return 3;
    if (cat === 'free') return 2;
    if (cat === 'ads') return 1;
    return 0; // rent/buy/unknown
  };
  for (const p of regionFiltered) {
    if (!isPreferredCategory(p.category)) continue;
    const name = p.name || p.provider_name || '';
    const cn = canonicalize(name);
    const key = cn.key || String(p.id);
    const existing = byKey.get(key);
    const score = catScore(p.category);
    const existingScore = existing ? catScore(existing.category) : -1;
    const rank = (typeof p.rank === 'number' ? p.rank : 999);
    const existingRank = existing && typeof existing.rank === 'number' ? existing.rank! : 999;
    if (!existing || score > existingScore || (score === existingScore && rank < existingRank)) {
      byKey.set(key, { ...p, name: cn.label, _label: cn.label });
    }
  }
  const items = Array.from(byKey.values()).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const getProviderLink = (provider: WatchProvider): string | null => {
    const country = (region || 'US').toLowerCase();
    // Generic provider home pages (region-aware where applicable), no title/search details
    const providerLinks: Record<string, string | null> = {
      'Netflix': 'https://www.netflix.com/',
      'Amazon Prime Video': 'https://www.primevideo.com/',
      'Hulu': 'https://www.hulu.com/',
      'Apple TV': `https://tv.apple.com/${country}/`,
      'Apple TV+': `https://tv.apple.com/${country}/`,
      'Apple TV Plus': `https://tv.apple.com/${country}/`,
      'Paramount Plus': country === 'us' ? 'https://www.paramountplus.com/' : 'https://www.paramountplus.com/intl/',
      'Max': 'https://www.max.com/',
      'Disney Plus': 'https://www.disneyplus.com/',
      'Google Play Movies': 'https://play.google.com/store/movies',
      'Fandango At Home': 'https://www.vudu.com/',
      'YouTube': 'https://www.youtube.com/',
    };
    
    return (
      providerLinks[provider.name] ||
      providerLinks[provider.provider_name || ''] ||
      provider.link_url ||
      `https://www.justwatch.com/${country}/`
    );
  };

  return (
    <div className={`grid ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2`}>
      {items.map((provider, idx) => {
        const link = getProviderLink(provider);
        
        // If no reliable deep link, show disabled tile but avoid region spam
        if (!link) {
          return (
            <div
              key={`${provider.id}-${idx}`}
              className="relative bg-zinc-800 rounded-lg p-3 opacity-50 cursor-not-allowed"
              title={`${provider.name} — посилання недоступне`}
            >
              <div className="flex items-center justify-center">
                {provider.logo_path ? (
                  <div className="relative w-8 h-8">
                    <Image
                      src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                      alt={provider.name}
                      width={32}
                      height={32}
                      className="rounded object-cover grayscale"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs">
                    📺
                  </div>
                )}
              </div>
            </div>
          );
        }
        
        return (
          <a
            key={`${provider.id}-${idx}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-zinc-800 rounded-lg p-3 hover:bg-zinc-700 transition-all duration-200 hover:scale-105 cursor-pointer"
            title={`Відкрити ${provider.name}`}
            aria-label={`Відкрити ${provider.name}`}
          >
            <div className="flex items-center justify-center">
              {provider.logo_path ? (
                <div className="relative w-8 h-8">
                  <Image
                    src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                    alt={provider.name}
                    width={32}
                    height={32}
                    className="rounded object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs">
                  📺
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
