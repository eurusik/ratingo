'use client';

import { useState } from 'react';

import { RotateCw } from 'lucide-react';

import { useAuth } from '@/core/auth/auth-context';
import { useAuthModalStore } from '@/core/auth/auth-modal.store';
import { useTranslation, useLocale } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { formatRelativeDate } from '@/shared/utils/format';

import { useShowSync } from '../hooks/use-show-sync';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

interface SyncButtonProps {
  slug: string;
  lastSyncedAt?: string | null;
  totalWatchers?: number | null;
}

export function SyncButton({ slug, lastSyncedAt, totalWatchers }: SyncButtonProps) {
  const { dict } = useTranslation();
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const { mutate, isPending } = useShowSync(slug);

  // Tracks when this session queued a sync (overrides stale SSR lastSyncedAt for cooldown UI)
  const [justQueuedAt, setJustQueuedAt] = useState<string | null>(null);
  // Tracks cooldown expiry returned by API when already on cooldown
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<string | null>(null);

  const effectiveLastSyncedAt = justQueuedAt ?? lastSyncedAt;

  const isInitiallyCooling =
    effectiveLastSyncedAt != null &&
    Date.now() - new Date(effectiveLastSyncedAt).getTime() < SEVEN_DAYS_MS;

  const hasActiveServerCooldown =
    cooldownExpiresAt != null && new Date(cooldownExpiresAt).getTime() > Date.now();
  const isOnCooldown = hasActiveServerCooldown || isInitiallyCooling;
  // Disable the button at the HTML level only for authenticated users on cooldown/loading.
  // Unauthenticated users must always be able to click to open the login modal.
  const isDisabled = isAuthenticated && (isPending || isOnCooldown);

  const handleSync = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    if (isDisabled) return;
    mutate(undefined, {
      onSuccess: (result) => {
        if (result.queued) {
          setJustQueuedAt(new Date().toISOString());
        } else if (result.cooldownExpiresAt) {
          setCooldownExpiresAt(result.cooldownExpiresAt);
        }
      },
    });
  };

  const cooldownDate = (hasActiveServerCooldown ? cooldownExpiresAt : null) ?? (isInitiallyCooling && effectiveLastSyncedAt
    ? new Date(new Date(effectiveLastSyncedAt).getTime() + SEVEN_DAYS_MS).toISOString()
    : null);

  const isUntracked = totalWatchers != null && totalWatchers === 0;

  return (
    <div className="flex flex-col gap-1 pt-1">
      <button
        onClick={handleSync}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors w-fit',
          isDisabled
            ? 'border-cinema-border text-cinema-text-disabled cursor-not-allowed'
            : 'border-cinema-border text-cinema-text-secondary hover:text-cinema-text-primary hover:border-cinema-border-hover',
        )}
        aria-label={dict.details.sync.button}
      >
        <RotateCw
          className={cn('w-3 h-3', isPending && 'animate-spin')}
        />
        <span>{dict.details.sync.button}</span>
      </button>

      {isOnCooldown && cooldownDate && (
        <p className="text-[11px] text-cinema-text-disabled">
          {dict.details.sync.cooldown.replace(
            '{date}',
            formatRelativeDate(cooldownDate, locale).text,
          )}
        </p>
      )}

      {!isOnCooldown && effectiveLastSyncedAt && (
        <p className="text-[11px] text-cinema-text-muted">
          {dict.details.sync.lastSynced.replace(
            '{time}',
            formatRelativeDate(effectiveLastSyncedAt, locale).text,
          )}
        </p>
      )}

      {!isOnCooldown && !effectiveLastSyncedAt && (
        <p className="text-[11px] text-cinema-text-muted">{dict.details.sync.neverSynced}</p>
      )}

      {isUntracked && (
        <p className="text-[11px] text-cinema-text-disabled">{dict.details.sync.autoSyncOff}</p>
      )}
    </div>
  );
}
