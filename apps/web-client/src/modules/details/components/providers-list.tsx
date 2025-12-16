/**
 * Providers list: "Де дивитись" block.
 * Displays streaming providers with logos from TMDB.
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
  if (!providers) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">{dict.details.providers.noProviders}</p>
      </div>
    );
  }

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
        <ProvidersRegionBadge 
          region={providers.region} 
          isFallback={providers.isFallback} 
        />
      )}

      {/* Categories */}
      <ProvidersCategory 
        title={dict.details.providers.stream} 
        providers={providers.stream || []} 
      />
      
      <ProvidersCategory 
        title={dict.details.providers.rent} 
        providers={providers.rent || []} 
      />
      
      <ProvidersCategory 
        title={dict.details.providers.buy} 
        providers={providers.buy || []} 
      />

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
        <p className="text-xs text-zinc-500">
          * {dict.details.providers.officialNote}
        </p>
      </div>
    </div>
  );
}
