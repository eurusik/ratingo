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
 */

'use client';

import { Info, TrendingDown, User, Target, Bookmark } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';

/**
 * Verdict types by data source
 */
export type VerdictType = 
  | 'season_comparison'   // Season comparisons
  | 'user_context'        // Personal context
  | 'genre_match'         // Genre profile
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
   * Show "Save" CTA button inside verdict
   */
  showCta?: boolean;

  /**
   * CTA props
   */
  ctaProps?: {
    isSaved?: boolean;
    hasNewEpisodes?: boolean;
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
    iconColor: 'text-amber-400/70',
    textColor: 'text-amber-50',
    bgGradient: 'bg-gradient-to-br from-amber-500/5 via-transparent to-transparent',
    borderColor: 'border-l-amber-400/20',
    ctaAccent: 'amber', // CTA button accent color
  },
  user_context: {
    icon: User,
    iconColor: 'text-blue-400/70',
    textColor: 'text-blue-50',
    bgGradient: 'bg-gradient-to-br from-blue-500/5 via-transparent to-transparent',
    borderColor: 'border-l-blue-400/20',
    ctaAccent: 'blue',
  },
  genre_match: {
    icon: Target,
    iconColor: 'text-purple-400/70',
    textColor: 'text-purple-50',
    bgGradient: 'bg-gradient-to-br from-purple-500/5 via-transparent to-transparent',
    borderColor: 'border-l-purple-400/20',
    ctaAccent: 'purple',
  },
  general: {
    icon: Info,
    iconColor: 'text-zinc-400/70',
    textColor: 'text-zinc-50',
    bgGradient: 'bg-gradient-to-br from-zinc-500/5 via-transparent to-transparent',
    borderColor: 'border-l-zinc-400/20',
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
  const accent = config.ctaAccent;

  // Handle save action (will be connected to real API later)
  const handleSave = () => {
    console.log('Save clicked - will integrate with API');
    // TODO: Call API to save to watchlist
  };

  // Dynamic CTA styles based on verdict type
  const getCtaStyles = () => {
    const accentStyles = {
      amber: {
        border: 'border-amber-500/50',
        borderHover: 'hover:border-amber-500/70',
        bg: 'bg-amber-500/10',
        bgHover: 'hover:bg-amber-500/5',
        text: 'text-amber-400',
        textHover: 'hover:text-amber-300',
        iconHover: 'group-hover:text-amber-400',
        arrowHover: 'group-hover:text-amber-400',
        separator: 'border-amber-500/20',
        shadow: 'shadow-lg shadow-amber-500/20',
        shadowHover: 'hover:shadow-lg hover:shadow-amber-500/10',
      },
      blue: {
        border: 'border-blue-500/50',
        borderHover: 'hover:border-blue-500/70',
        bg: 'bg-blue-500/10',
        bgHover: 'hover:bg-blue-500/5',
        text: 'text-blue-400',
        textHover: 'hover:text-blue-300',
        iconHover: 'group-hover:text-blue-400',
        arrowHover: 'group-hover:text-blue-400',
        separator: 'border-blue-500/20',
        shadow: 'shadow-lg shadow-blue-500/20',
        shadowHover: 'hover:shadow-lg hover:shadow-blue-500/10',
      },
      purple: {
        border: 'border-purple-500/50',
        borderHover: 'hover:border-purple-500/70',
        bg: 'bg-purple-500/10',
        bgHover: 'hover:bg-purple-500/5',
        text: 'text-purple-400',
        textHover: 'hover:text-purple-300',
        iconHover: 'group-hover:text-purple-400',
        arrowHover: 'group-hover:text-purple-400',
        separator: 'border-purple-500/20',
        shadow: 'shadow-lg shadow-purple-500/20',
        shadowHover: 'hover:shadow-lg hover:shadow-purple-500/10',
      },
      zinc: {
        border: 'border-zinc-500/50',
        borderHover: 'hover:border-zinc-500/70',
        bg: 'bg-zinc-500/10',
        bgHover: 'hover:bg-zinc-500/5',
        text: 'text-zinc-400',
        textHover: 'hover:text-zinc-300',
        iconHover: 'group-hover:text-zinc-400',
        arrowHover: 'group-hover:text-zinc-400',
        separator: 'border-zinc-500/20',
        shadow: 'shadow-lg shadow-zinc-500/20',
        shadowHover: 'hover:shadow-lg hover:shadow-zinc-500/10',
      },
    };

    const styles = accentStyles[accent];

    if (ctaProps?.isSaved) {
      return {
        button: cn(styles.border, styles.bg, styles.text, styles.shadow),
        icon: styles.text,
        separator: styles.separator,
      };
    }

    return {
      button: cn('border-zinc-600/60', styles.borderHover, styles.bgHover, 'text-zinc-200', styles.textHover, styles.shadowHover),
      icon: cn('text-zinc-300', styles.iconHover, 'group-hover:scale-110 group-hover:fill-current'),
      arrow: cn('text-zinc-500', styles.arrowHover, 'group-hover:translate-x-1 group-hover:scale-110'),
      separator: styles.separator,
    };
  };

  const ctaStyles = getCtaStyles();

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
          <p className="text-xs font-medium text-zinc-500/80 uppercase tracking-wider">
            {dict.details.verdict.byData}
          </p>

          {/* Main message */}
          <p className={cn('text-base leading-relaxed font-medium', config.textColor)}>
            {message}
          </p>

          {/* Additional context (optional) */}
          {context && (
            <p className="text-xs text-zinc-500 leading-relaxed">
              {context}
            </p>
          )}

          {/* DEBUG: confidence level (show only in dev) */}
          {process.env.NODE_ENV === 'development' && confidence && (
            <p className="text-xs text-zinc-600 mt-1">
              Confidence: {confidence}
            </p>
          )}

          {/* CTA: Save button with dynamic accent color matching verdict type */}
          {showCta && (
            <div className={cn('mt-4 pt-4 border-t', ctaStyles.separator)}>
              <button
                onClick={handleSave}
                className={cn(
                  'group w-full px-4 py-3 rounded-lg border transition-all duration-300',
                  'flex items-center justify-between',
                  ctaStyles.button
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Bookmark className={cn(
                    'w-4 h-4 transition-all duration-300',
                    ctaProps?.isSaved 
                      ? cn('fill-current', ctaStyles.icon)
                      : ctaStyles.icon
                  )} />
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium text-sm leading-tight">
                      {ctaProps?.isSaved ? dict.details.saved : dict.details.save}
                    </span>
                    <span className="text-[13px] text-zinc-400 group-hover:text-zinc-300 transition-colors leading-tight">
                      {ctaProps?.hasNewEpisodes 
                        ? dict.details.cta.saveHint.newEpisodes
                        : dict.details.cta.saveHint.general
                      }
                    </span>
                  </div>
                </div>
                <span className={cn(
                  'transition-all duration-300',
                  ctaStyles.arrow || 'text-zinc-500 group-hover:translate-x-1 group-hover:scale-110'
                )}>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
