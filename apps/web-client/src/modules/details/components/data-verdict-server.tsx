/**
 * Server component for data-driven verdict display.
 * Renders Ratingo's smart insights based on metrics.
 */

import type { components } from '@ratingo/api-contract';
import { Info, TrendingDown, User, Star, Flame, Calendar, AlertTriangle } from 'lucide-react';
import type { PrimaryCta } from '@/shared/types';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';
import { VerdictCtaButton } from './verdict-cta-button';

/** Verdict type from API. */
type ApiVerdictType = components['schemas']['MovieVerdictDto']['type'];

/** Extended verdict type with UI-only variants. */
export type VerdictType = ApiVerdictType | 'season_comparison' | 'user_context';

/** Verdict hint key for CTA. */
export type VerdictHintKey = components['schemas']['MovieVerdictDto']['hintKey'];

/** Confidence level for verdict accuracy. */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DataVerdictServerProps {
  /** Verdict type (determines icon and style). */
  type: VerdictType;
  /** Main verdict message. */
  message: string;
  /** Verdict message key (for reasonKey when saving). */
  messageKey?: string | null;
  /** Confidence level (for future use). */
  confidence?: ConfidenceLevel;
  /** Additional context text. */
  context?: string;
  /** Whether to show CTA button. */
  showCta?: boolean;
  /** CTA configuration. */
  ctaProps?: {
    isSaved?: boolean;
    isLoading?: boolean;
    hasNewEpisodes?: boolean;
    hintKey?: VerdictHintKey;
    primaryCta?: PrimaryCta;
    continuePoint?: { season: number; episode: number } | null;
    onSave?: () => void;
    // Subscription props
    mediaType?: 'movie' | 'show';
    subscriptionTrigger?: 'release' | 'new_season' | 'on_streaming' | null;
    isSubscribed?: boolean;
    isSubscriptionLoading?: boolean;
    onSubscriptionToggle?: () => void;
  };
  /** Translation dictionary. */
  dict: ReturnType<typeof getDictionary>;
}

const verdictConfig: Record<VerdictType, {
  icon: typeof Info;
  iconColor: string;
  textColor: string;
  bgGradient: string;
  borderColor: string;
  ctaAccent: string;
}> = {
  season_comparison: {
    icon: TrendingDown,
    iconColor: 'text-amber-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    borderColor: 'border-l-amber-400/40',
    ctaAccent: 'amber',
  },
  user_context: {
    icon: User,
    iconColor: 'text-blue-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent',
    borderColor: 'border-l-blue-400/40',
    ctaAccent: 'blue',
  },
  general: {
    icon: Info,
    iconColor: 'text-zinc-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-zinc-500/15 via-zinc-500/5 to-transparent',
    borderColor: 'border-l-zinc-400/40',
    ctaAccent: 'zinc',
  },
  quality: {
    icon: Star,
    iconColor: 'text-green-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent',
    borderColor: 'border-l-green-400/40',
    ctaAccent: 'green',
  },
  popularity: {
    icon: Flame,
    iconColor: 'text-purple-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent',
    borderColor: 'border-l-purple-400/40',
    ctaAccent: 'purple',
  },
  release: {
    icon: Calendar,
    iconColor: 'text-cyan-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-transparent',
    borderColor: 'border-l-cyan-400/40',
    ctaAccent: 'cyan',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-orange-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-orange-500/15 via-orange-500/5 to-transparent',
    borderColor: 'border-l-orange-400/40',
    ctaAccent: 'orange',
  },
};

export function DataVerdictServer({
  type,
  message,
  confidence,
  context,
  showCta = false,
  ctaProps,
  dict,
}: DataVerdictServerProps) {
  const config = verdictConfig[type];
  const Icon = config.icon;

  // CTA-only mode: no message, just the CTA button in container
  const isCtaOnly = !message && showCta && !!ctaProps;

  return (
    <section
      className={cn(
        'relative rounded-2xl p-5 border-l-2 backdrop-blur-sm',
        config.bgGradient,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon - always show */}
        <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', config.iconColor)} />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: "Based on Ratingo data" - always show */}
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {dict.details.verdict.byData}
          </p>

          {/* Main message - only show if exists */}
          {message && (
            <p className={cn('text-base leading-relaxed font-medium', config.textColor)}>
              {message}
            </p>
          )}

          {/* Additional context (optional) */}
          {context && (
            <p className="text-sm text-zinc-400 leading-relaxed">
              {context}
            </p>
          )}

          {/* Integrated CTA - Client Component for interactivity */}
          {showCta && ctaProps && (
            <VerdictCtaButton
              primaryCta={ctaProps.primaryCta}
              continuePoint={ctaProps.continuePoint}
              isSaved={ctaProps.isSaved}
              isLoading={ctaProps.isLoading}
              hasNewEpisodes={ctaProps.hasNewEpisodes}
              hintKey={ctaProps.hintKey}
              verdictType={type}
              dict={dict}
              onSave={ctaProps.onSave}
              mediaType={ctaProps.mediaType}
              subscriptionTrigger={ctaProps.subscriptionTrigger}
              isSubscribed={ctaProps.isSubscribed}
              isSubscriptionLoading={ctaProps.isSubscriptionLoading}
              onSubscriptionToggle={ctaProps.onSubscriptionToggle}
            />
          )}
        </div>
      </div>
    </section>
  );
}
