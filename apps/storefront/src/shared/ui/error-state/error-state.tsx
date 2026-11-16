import type { ReactNode } from 'react';

type ErrorStateTone = 'warning' | 'neutral' | 'success';

const BADGE_TONES: Record<ErrorStateTone, string> = {
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-surface text-muted',
  success: 'bg-success-soft text-success',
};

export const ERROR_STATE_ACTION =
  'h-12 w-full rounded-full px-5 text-[15px] font-bold no-underline md:w-auto';

interface ErrorStateProps {
  icon: ReactNode;
  tone?: ErrorStateTone;
  title: string;
  text: string;
  titleAs?: 'h1' | 'h2';
  announce?: 'alert' | 'status';
  actions?: ReactNode;
  footnote?: ReactNode;
}

export function ErrorState({
  icon,
  tone = 'warning',
  title,
  text,
  titleAs: Title = 'h1',
  announce = 'alert',
  actions,
  footnote,
}: ErrorStateProps) {
  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center gap-4.5 px-4 py-16 text-center md:min-h-0 md:max-w-xl md:justify-start md:gap-5 md:pt-28">
      <span
        aria-hidden
        className={`relative flex size-18 shrink-0 items-center justify-center rounded-full [&>svg]:size-8.5 ${BADGE_TONES[tone]}`}
      >
        {icon}
      </span>
      <div role={announce} className="flex flex-col gap-1.5">
        <Title className="text-2xl font-extrabold tracking-tight text-balance md:text-[32px]">
          {title}
        </Title>
        <p className="text-[15px] leading-normal text-pretty text-muted md:text-base">{text}</p>
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:gap-2.5">{actions}</div>
      ) : null}
      {footnote ? <p className="text-xs text-muted tabular-nums md:text-[13px]">{footnote}</p> : null}
    </div>
  );
}
