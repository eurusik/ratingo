/**
 * Smart CTA button for media cards.
 *
 * Shows different action based on CardMetaDto.primaryCta:
 * - OPEN: "Деталі" → navigate to detail page
 * - SAVE: "Зберегти" → add to guest watchlist
 * - CONTINUE: "Продовжити" → resume from saved point
 * - WHERE_TO_WATCH: "Де дивитись" → show streaming providers
 *
 * IMPORTANT: We NEVER use "Дивитись" or play icons.
 * Ratingo is a discovery tool, not a video player.
 */

import { Info, Bookmark, ArrowRight, MapPin } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';

type CtaType = 'SAVE' | 'CONTINUE' | 'OPEN' | 'WHERE_TO_WATCH';

interface CardCtaProps {
  /** CTA type from backend. */
  type: CtaType;
  /** Continue point for CONTINUE type. */
  continuePoint?: { season: number; episode: number } | null;
  /** Click handler. */
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const ctaConfig: Record<CtaType, { labelKey: string; icon: React.ElementType; variant: string }> = {
  OPEN: {
    labelKey: 'card.cta.details',
    icon: Info,
    variant: 'bg-white/10 hover:bg-white/20 text-white',
  },
  SAVE: {
    labelKey: 'card.cta.save',
    icon: Bookmark,
    variant: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400',
  },
  CONTINUE: {
    labelKey: 'card.cta.continue',
    icon: ArrowRight,
    variant: 'bg-green-500/20 hover:bg-green-500/30 text-green-400',
  },
  WHERE_TO_WATCH: {
    labelKey: 'card.cta.whereToWatch',
    icon: MapPin,
    variant: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400',
  },
};

/**
 * Action button for media card.
 *
 * @example
 * <CardCta type="CONTINUE" continuePoint={{ season: 2, episode: 5 }} />
 * // [▶] Продовжити S2E5
 */
export function CardCta({ type, continuePoint, onClick, className }: CardCtaProps) {
  const { t } = useTranslation();
  const config = ctaConfig[type];
  const Icon = config.icon;

  // Build label with continue point if applicable
  let label = t(config.labelKey);
  if (type === 'CONTINUE' && continuePoint) {
    label = `${label} S${continuePoint.season}E${continuePoint.episode}`;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg',
        'text-sm font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        config.variant,
        className
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
