/**
 * Individual provider card with logo only (compact design).
 */

import Image from 'next/image';
import type { components } from '@ratingo/api-contract';

type WatchProvider = components['schemas']['WatchProviderDto'];

interface ProviderCardProps {
  provider: WatchProvider;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  return (
    <div 
      className="relative group flex items-center justify-center p-1 bg-white rounded-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all cursor-pointer"
      title={provider.name}
    >
      {/* Logo */}
      {provider.logo ? (
        <div className="relative w-12 h-12">
          <Image
            src={provider.logo.small}
            alt={provider.name}
            fill
            sizes="48px"
            className="object-contain"
          />
        </div>
      ) : (
        <div className="w-12 h-12 flex items-center justify-center">
          <span className="text-sm text-zinc-800 font-bold">
            {provider.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}

      {/* Tooltip on hover */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {provider.name}
        </div>
      </div>
    </div>
  );
}
