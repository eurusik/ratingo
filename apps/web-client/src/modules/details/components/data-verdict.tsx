/**
 * Data-driven verdict: Ratingo's smart insights based on metrics.
 *
 */

import { Info, TrendingDown, User, Star, Flame, Calendar, AlertTriangle } from 'lucide-react';
import type { PrimaryCta } from '@/shared/types';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';
import { VerdictCtaButton } from './verdict-cta-button';

/**
 * Verdict types by data source
 */
export type VerdictType = 
  | 'season_comparison'   // Season comparisons (amber)
  | 'user_context'        // Personal context (blue)
  | 'general'             // General insight (zinc)
  | 'quality'             // Quality/ratings (green)
  | 'popularity'          // Trending/popularity (purple)
  | 'release'             // Release timing (cyan)
  | 'warning';            // Negative/caution (red/orange)

/**
 * Confidence level (for future logic)
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DataVerdictProps {
  /**
   * Verdict type (determines icon + style)
   */
  type: VerdictType;

  /**
   * Main message
   * @example "Season 2 started weaker than the first"
   */
  message: string;

  /**
   * Confidence level (optional, for future use)
   */
  confidence?: ConfidenceLevel;

  /**
   * Additional context (optional)
   * @example "IMDb rating dropped by 0.8"
   */
  context?: string;

  /**
   * Show integrated CTA
   */
  showCta?: boolean;

  /**
   * CTA configuration (serializable data only)
   */
  ctaProps?: {
    isSaved?: boolean;
    hasNewEpisodes?: boolean;
    hintKey?: 'newEpisodes' | 'afterAllEpisodes' | 'whenOnStreaming' | 'notifyNewEpisode' | 'general' | 'forLater' | 'notifyRelease' | 'decideToWatch';
    primaryCta?: PrimaryCta;
    continuePoint?: { season: number; episode: number } | null;
    onSave?: () => void;
  };

  /**
   * Translation dictionary
   */
  dict: ReturnType<typeof getDictionary>;
}

/**
 * Icon and style configuration for each verdict type
 */
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

export function DataVerdict({
  type,
  message,
  confidence,
  context,
  showCta = false,
  ctaProps,
  dict,
}: DataVerdictProps) {
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
              hasNewEpisodes={ctaProps.hasNewEpisodes}
              hintKey={ctaProps.hintKey}
              verdictType={type}
              dict={dict}
            />
          )}
        </div>
      </div>
    </section>
  );
}
