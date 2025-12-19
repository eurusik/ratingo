/**
 * Card component for subscription items (notifications).
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { Bell, BellOff } from 'lucide-react';
import { cn } from '@/shared/utils';
import { Button, Badge } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { SubscriptionTrigger, MediaType } from '@/shared/types';

interface SubscriptionCardProps {
  id: string;
  mediaItemId: string;
  title: string;
  type: 'movie' | 'show';
  slug: string;
  posterUrl: string | null;
  trigger: SubscriptionTrigger;
  onUnsubscribe?: () => void;
  isUnsubscribing?: boolean;
}

export function SubscriptionCard({
  title,
  type,
  slug,
  posterUrl,
  trigger,
  onUnsubscribe,
  isUnsubscribing,
}: SubscriptionCardProps) {
  const { dict } = useTranslation();
  const href = type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`;

  const triggerLabels: Record<SubscriptionTrigger, string> = {
    release: dict.saved.trigger.release,
    new_season: dict.saved.trigger.new_season,
    on_streaming: dict.saved.trigger.on_streaming,
  };

  return (
    <div className="group relative flex gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
      {/* Poster */}
      <Link href={href as Route} className="shrink-0">
        <div className="relative w-16 h-24 rounded-md overflow-hidden bg-zinc-800">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
              —
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <Link href={href as Route} className="block">
            <h3 className="font-medium text-zinc-100 truncate hover:text-white transition-colors">
              {title}
            </h3>
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default" className="text-xs">
              <Bell className="w-3 h-3 mr-1" />
              {triggerLabels[trigger]}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          {onUnsubscribe && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnsubscribe}
              disabled={isUnsubscribing}
              className={cn(
                "h-7 px-2 text-xs",
                "text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
              )}
            >
              <BellOff className="w-3 h-3 mr-1" />
              {dict.saved.actions.unsubscribe}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
