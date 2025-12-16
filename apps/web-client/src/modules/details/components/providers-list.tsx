/**
 * Providers list: "Де дивитись" block.
 *
 */

import { ChevronRight } from 'lucide-react';
import type { Provider } from '../types';
import type { getDictionary } from '@/shared/i18n';

export interface ProvidersListProps {
  providers?: Provider[];
  dict: ReturnType<typeof getDictionary>;
}

export function ProvidersList({ providers, dict }: ProvidersListProps) {

  if (!providers || providers.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">{dict.details.providers.noProviders}</p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <a
            key={provider.id}
            href={`#provider-${provider.id}`}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            {provider.name}
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </a>
        ))}
      </div>
      <p className="text-xs text-zinc-500 mt-3">
        * {dict.details.providers.officialNote}
      </p>
    </>
  );
}
