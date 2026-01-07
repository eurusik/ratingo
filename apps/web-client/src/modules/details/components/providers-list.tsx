/**
 * Providers list: "Де дивитись" block.
 * Displays streaming providers with logos from TMDB.
 * Shows fallback states when subscription providers unavailable.
 */

import { ExternalLink } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';
import { ProvidersRegionBadge } from './providers-region-badge';
import { ProvidersCategory } from './providers-category';

type Availability = components['schemas']['AvailabilityDto'];

export interface ProvidersListProps {
  providers?: Availability;
  dict: ReturnType<typeof getDictionary>;
}

export function ProvidersList({ providers, dict }: ProvidersListProps) {
  // No availability data at all
  if (!providers) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">{dict.details.providers.noInfo}</p>
      </div>
    );
  }

  const { hint, tmdbWatchUrl } = providers;

  // TVOD only: no subscription, but rent/buy exists in raw data
  if (hint === 'tvod_only') {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <p className="text-zinc-400 text-sm font-medium">
            {dict.details.providers.notOnSubscription}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            {dict.details.providers.availableForPurchase}
          </p>
        </div>

        {tmdbWatchUrl && (
          <div className="flex justify-center">
            <a
              href={tmdbWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors px-4 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800"
            >
              {dict.details.providers.viewOnTmdb}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    );
  }

  // No data at all
  if (hint === 'none') {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">{dict.details.providers.noInfo}</p>
      </div>
    );
  }

  // SVOD: has normalized providers
  const allProviders = [
    ...(providers.stream || []),
    ...(providers.rent || []),
    ...(providers.buy || []),
  ];

  if (allProviders.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">{dict.details.providers.noProviders}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Region info */}
      {providers.region && (
        <ProvidersRegionBadge region={providers.region} isFallback={providers.isFallback} />
      )}

      {/* Categories */}
      <ProvidersCategory title={dict.details.providers.stream} providers={providers.stream || []} />

      <ProvidersCategory title={dict.details.providers.rent} providers={providers.rent || []} />

      <ProvidersCategory title={dict.details.providers.buy} providers={providers.buy || []} />

      {/* Footer */}
      <div className="pt-4 border-t border-zinc-800/50 space-y-3">
        {/* TMDB link */}
        {providers.link && (
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Більше інфо на TMDB
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {/* Official note */}
        <p className="text-xs text-zinc-500">* {dict.details.providers.officialNote}</p>
      </div>
    </div>
  );
}
