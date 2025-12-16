/**
 * Providers category section (Stream/Rent/Buy).
 */

import type { components } from '@ratingo/api-contract';
import { ProviderCard } from './provider-card';

type WatchProvider = components['schemas']['WatchProviderDto'];

interface ProvidersCategoryProps {
  title: string;
  providers: WatchProvider[];
}

export function ProvidersCategory({ title, providers }: ProvidersCategoryProps) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <ProviderCard key={provider.providerId} provider={provider} />
        ))}
      </div>
    </div>
  );
}
