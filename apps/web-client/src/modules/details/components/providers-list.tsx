/**
 * Providers list: "Де дивитись" block.
 *
 */

import { ChevronRight, ExternalLink } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import type { getDictionary } from '@/shared/i18n';

type WatchProvider = components['schemas']['WatchProviderDto'];
type Availability = components['schemas']['AvailabilityDto'];

export interface ProvidersListProps {
  providers?: Availability;
  dict: ReturnType<typeof getDictionary>;
}

export function ProvidersList({ providers, dict }: ProvidersListProps) {
  if (!providers) {
    return (
      <p className="text-zinc-500 text-sm">{dict.details.providers.noProviders}</p>
    );
  }

  const allProviders = [
    ...(providers.stream || []),
    ...(providers.rent || []),
    ...(providers.buy || []),
  ];

  if (allProviders.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">{dict.details.providers.noProviders}</p>
    );
  }

  return (
    <>
      {/* Region info */}
      {providers.region && (
        <p className="text-xs text-zinc-500 mb-3">
          {providers.isFallback 
            ? `⚠️ Для України даних немає, показані сервіси для ${providers.region}`
            : `Сервіси для ${providers.region}`
          }
        </p>
      )}

      {/* Stream providers */}
      {providers.stream && providers.stream.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">
            {dict.details.providers.stream}
          </h3>
          <div className="flex flex-wrap gap-2">
            {providers.stream.map((provider) => (
              <div
                key={provider.providerId}
                className="px-4 py-2.5 bg-zinc-800 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                {provider.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rent providers */}
      {providers.rent && providers.rent.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">
            {dict.details.providers.rent}
          </h3>
          <div className="flex flex-wrap gap-2">
            {providers.rent.map((provider) => (
              <div
                key={provider.providerId}
                className="px-4 py-2.5 bg-zinc-800 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                {provider.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buy providers */}
      {providers.buy && providers.buy.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">
            {dict.details.providers.buy}
          </h3>
          <div className="flex flex-wrap gap-2">
            {providers.buy.map((provider) => (
              <div
                key={provider.providerId}
                className="px-4 py-2.5 bg-zinc-800 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                {provider.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TMDB link */}
      {providers.link && (
        <a
          href={providers.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-4"
        >
          Більше інфо на TMDB
          <ExternalLink className="w-4 h-4" />
        </a>
      )}

      <p className="text-xs text-zinc-500 mt-3">
        * {dict.details.providers.officialNote}
      </p>
    </>
  );
}
