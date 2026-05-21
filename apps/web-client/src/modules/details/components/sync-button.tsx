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

  const [justQueuedAt, setJustQueuedAt] = useState<string | null>(null);
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<string | null>(null);

  const effectiveLastSyncedAt = justQueuedAt ?? lastSyncedAt;

  const isInitiallyCooling =
    effectiveLastSyncedAt != null &&
    Date.now() - new Date(effectiveLastSyncedAt).getTime() < SEVEN_DAYS_MS;

  const hasActiveServerCooldown =
    cooldownExpiresAt != null && new Date(cooldownExpiresAt).getTime() > Date.now();
  const isOnCooldown = hasActiveServerCooldown || isInitiallyCooling;

  // Disable at HTML level only for authenticated users — guests must always click to open login modal
  const isDisabled = isAuthenticated && (isPending || isOnCooldown);

  const handleSync = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    if (isPending || isOnCooldown) return;
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

  const cooldownDate =
    (hasActiveServerCooldown ? cooldownExpiresAt : null) ??
    (isInitiallyCooling && effectiveLastSyncedAt
      ? new Date(new Date(effectiveLastSyncedAt).getTime() + SEVEN_DAYS_MS).toISOString()
      : null);

  const isUntracked = totalWatchers != null && totalWatchers === 0;

  let label: string;
  if (isPending) {
    label = dict.details.sync.button;
  } else if (isOnCooldown && cooldownDate) {
    label = dict.details.sync.cooldown.replace(
      '{date}',
      formatRelativeDate(cooldownDate, locale).text,
    );
  } else if (effectiveLastSyncedAt) {
    label = dict.details.sync.lastSynced.replace(
      '{time}',
      formatRelativeDate(effectiveLastSyncedAt, locale).text,
    );
  } else {
    label = dict.details.sync.neverSynced;
  }

  if (isUntracked) {
    label += ` · ${dict.details.sync.autoSyncOff}`;
  }

  return (
    // py-2.5 / -my-2.5 expands the tap target to ~44px on mobile without affecting visual spacing
    <button
      onClick={handleSync}
      disabled={isDisabled}
      className={cn(
        'flex items-center gap-1.5 text-xs py-2.5 -my-2.5 w-full text-left transition-colors',
        isDisabled
          ? 'text-cinema-text-disabled cursor-not-allowed'
          : 'text-cinema-text-muted hover:text-cinema-text-secondary active:opacity-70 cursor-pointer',
      )}
      aria-label={dict.details.sync.button}
    >
      <RotateCw className={cn('w-3 h-3 shrink-0', isPending && 'animate-spin')} />
      <span>{label}</span>
    </button>
  );
}
