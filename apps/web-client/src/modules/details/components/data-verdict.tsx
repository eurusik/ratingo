/**
 * Data-driven verdict: Ratingo's smart insights based on metrics.
 *
 * Sources:
 * 1. Season comparisons (rating delta, watchers)
 * 2. User context (user watched S1 → recommend S2)
 * 3. Genre/tone profile (for fans of X)
 *
 * Important: NOT an expert opinion, but a data-based inference.
 *
 * CTA Philosophy:
 * CTA copy follows the principle: "дія + причина (1 рядок)"
 * - Never pressures or oversells
 * - Explains WHY to act NOW in context of the verdict
 * - Always calm, brief, without emotional words
 * - ALWAYS answers: "What decision can I make later?" (watch/not watch, now/later)
 * 
 * Examples:
 * - season_comparison (weak start) → "щоб вирішити, дивитись чи ні, після виходу всіх серій"
 * - ongoing series → "щоб не пропустити нові серії" 
 * - movie/not streaming → "щоб повернутися, коли буде на стрімінгах"
 * - general → "нагадаємо, коли вийде нова серія"
 * 
 * Rule: If the text doesn't clearly state WHAT decision (watch/don't watch, now/later),
 * the copy is incomplete.
 * 
 * Positioning: "Пульт вибору, а не телевізор" (Discovery tool, not player)
 */

'use client';

import { Info, TrendingDown, User, Bookmark, Check, Plus } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';

/**
 * Verdict types by data source
 */
export type VerdictType = 
  | 'season_comparison'   // Season comparisons
  | 'user_context'        // Personal context
  | 'general';            // General insight

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
   * CTA state
   */
  ctaProps?: {
    isSaved?: boolean;
    hasNewEpisodes?: boolean;
    /** Custom hint key for context-specific CTA copy */
    hintKey?: 'newEpisodes' | 'afterAllEpisodes' | 'whenOnStreaming' | 'notifyNewEpisode' | 'general';
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
const verdictConfig = {
  season_comparison: {
    icon: TrendingDown,
    iconColor: 'text-amber-400',
    textColor: 'text-white',
    bgGradient: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    borderColor: 'border-l-amber-400/40',
    ctaAccent: 'amber', // CTA button accent color
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
} as const;

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

  // Dynamic CTA gradient based on verdict type
  const ctaGradientClasses = {
    season_comparison: 'bg-gradient-to-r from-amber-500/10 via-transparent to-transparent border-amber-500/20 hover:border-amber-500/30 hover:from-amber-500/15',
    user_context: 'bg-gradient-to-r from-blue-500/10 via-transparent to-transparent border-blue-500/20 hover:border-blue-500/30 hover:from-blue-500/15',
    general: 'bg-gradient-to-r from-zinc-500/10 via-transparent to-transparent border-zinc-500/20 hover:border-zinc-500/30 hover:from-zinc-500/15',
  } as const;

  return (
    <section
      className={cn(
        'relative rounded-2xl p-5 border-l-2 backdrop-blur-sm',
        config.bgGradient,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', config.iconColor)} />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: "Based on Ratingo data" */}
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {dict.details.verdict.byData}
          </p>

          {/* Main message */}
          <p className={cn('text-base leading-relaxed font-medium', config.textColor)}>
            {message}
          </p>

          {/* Additional context (optional) */}
          {context && (
            <p className="text-sm text-zinc-400 leading-relaxed">
              {context}
            </p>
          )}

          {/* DEBUG: confidence level (show only in dev) */}
          {process.env.NODE_ENV === 'development' && confidence && (
            <p className="text-xs text-zinc-600 mt-1">
              Confidence: {confidence}
            </p>
          )}

          {/* Integrated CTA */}
          {showCta && (
            <button
              onClick={ctaProps?.onSave}
              className={cn(
                'group flex items-center justify-between w-full mt-4 pt-4 border-t',
                '-mx-5 px-5 -mb-5 pb-5 rounded-b-2xl',
                ctaGradientClasses[type],
                'transition-all'
              )}
            >
              <div className="flex flex-col items-start">
                <span className={cn(
                  'text-sm font-medium',
                  ctaProps?.isSaved ? 'text-green-400' : 'text-zinc-200'
                )}>
                  {ctaProps?.isSaved ? dict.details.saved : dict.details.save}
                </span>
                {!ctaProps?.isSaved && (
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    {ctaProps?.hintKey 
                      ? dict.details.cta.saveHint[ctaProps.hintKey]
                      : ctaProps?.hasNewEpisodes
                        ? dict.details.cta.saveHint.newEpisodes
                        : dict.details.cta.saveHint.general}
                  </span>
                )}
              </div>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                ctaProps?.isSaved 
                  ? 'bg-green-500/20' 
                  : 'bg-zinc-800 group-hover:bg-zinc-700'
              )}>
                <Check className={cn(
                  'w-4 h-4 transition-all',
                  ctaProps?.isSaved 
                    ? 'text-green-500' 
                    : 'text-zinc-500 group-hover:text-zinc-300'
                )} />
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
