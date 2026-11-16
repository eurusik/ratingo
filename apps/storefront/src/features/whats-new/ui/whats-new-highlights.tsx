import { AlignLeft, Bell, Clock, Info, Smartphone, Zap, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

type HighlightKey = 'my' | 'next' | 'app' | 'faster' | 'following';

export interface Highlight {
  key: HighlightKey;
  icon: LucideIcon;
  tone: string;
}

const MY: Highlight = { key: 'my', icon: AlignLeft, tone: 'bg-accent' };
const NEXT: Highlight = { key: 'next', icon: Clock, tone: 'bg-green-600' };
const FOLLOWING: Highlight = { key: 'following', icon: Bell, tone: 'bg-amber-500' };

export const PHONE_HIGHLIGHTS: readonly Highlight[] = [
  MY,
  NEXT,
  { key: 'app', icon: Smartphone, tone: 'bg-violet-600' },
  FOLLOWING,
];

export const DESKTOP_HIGHLIGHTS: readonly Highlight[] = [
  MY,
  NEXT,
  { key: 'faster', icon: Zap, tone: 'bg-violet-600' },
  FOLLOWING,
];

interface WhatsNewHighlightsProps {
  highlights: readonly Highlight[];
  hasIosIconHint: boolean;
}

export function WhatsNewHighlights({ highlights, hasIosIconHint }: WhatsNewHighlightsProps) {
  const { dict } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      {hasIosIconHint ? (
        <p
          role="note"
          className="flex items-start gap-3 rounded-2xl bg-default px-3.5 py-3 text-sm leading-snug text-foreground/85"
        >
          <Info aria-hidden className="mt-px size-[18px] shrink-0 text-accent" />
          <span>{dict.whatsNew.iosIconHint}</span>
        </p>
      ) : null}
      <ul role="list" className="flex flex-col gap-4">
        {highlights.map(({ key, icon: Icon, tone }) => (
          <li key={key} className="flex items-start gap-3.5">
            <span
              aria-hidden
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-white ${tone}`}
            >
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 pt-px">
              <span className="text-base font-bold text-foreground">
                {dict.whatsNew.highlights[key].title}
              </span>
              <span className="text-sm leading-snug text-muted">
                {dict.whatsNew.highlights[key].text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
