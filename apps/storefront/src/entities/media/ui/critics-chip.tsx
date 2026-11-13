import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';

function TomatoIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0">
      <circle cx="8" cy="9.2" r="6" fill="#e5402b" />
      <path
        fill="#3e9c35"
        d="M8 3.6c-.9-1.2-2.4-1.6-3.4-1 1 .1 1.9.7 2.4 1.5-1-.3-2.2 0-2.9.7 1.2-.2 2.4.1 3.2.8.3-.6.5-1.3.7-2z"
      />
      <path
        fill="#4cb044"
        d="M8 3.6c.9-1.2 2.4-1.6 3.4-1-1 .1-1.9.7-2.4 1.5 1-.3 2.2 0 2.9.7-1.2-.2-2.4.1-3.2.8-.3-.6-.5-1.3-.7-2z"
      />
    </svg>
  );
}

export function CriticsChip({ percent }: { percent: number }) {
  const { dict } = useTranslation();
  const rounded = Math.round(percent);

  return (
    <Chip
      size="md"
      className="gap-1.5 bg-black/80 ps-2 text-xs font-extrabold text-white tabular-nums"
    >
      <TomatoIcon />
      <span aria-hidden>{`${rounded}%`}</span>
      <span className="sr-only">{interpolate(dict.media.criticsLabel, { percent: rounded })}</span>
    </Chip>
  );
}
