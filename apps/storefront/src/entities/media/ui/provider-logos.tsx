import { Avatar } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { WatchProvider } from '../model/media';

const VISIBLE_PROVIDERS = 3;

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function ProviderLogos({ providers }: { providers: WatchProvider[] }) {
  const { dict } = useTranslation();

  if (providers.length === 0) return null;

  const visible = providers.slice(0, VISIBLE_PROVIDERS);
  const hiddenCount = providers.length - visible.length;

  return (
    <ul aria-label={dict.media.providers} className="flex shrink-0 items-center gap-1">
      {visible.map((provider) => (
        <li key={provider.id}>
          <Avatar size="sm" className="size-6 rounded-md bg-surface-secondary">
            {provider.logoUrl ? <Avatar.Image src={provider.logoUrl} alt={provider.name} /> : null}
            <Avatar.Fallback className="text-[10px] font-extrabold">
              <span aria-hidden>{initials(provider.name)}</span>
              {provider.logoUrl ? null : <span className="sr-only">{provider.name}</span>}
            </Avatar.Fallback>
          </Avatar>
        </li>
      ))}
      {hiddenCount > 0 ? (
        <li className="ps-1 text-xs text-muted tabular-nums">
          {interpolate(dict.media.moreProviders, { count: hiddenCount })}
        </li>
      ) : null}
    </ul>
  );
}
