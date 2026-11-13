import type { ReactNode } from 'react';
import { Chip } from '@heroui/react';
import { CalendarPlus, Check, Clapperboard, Clock, X } from 'lucide-react';
import type { ShowStatus } from '../model/details-view';

type StatusTone = 'success' | 'default' | 'danger' | 'accent';

const TONE_ICON_COLOR: Record<StatusTone, string> = {
  success: 'text-success',
  default: 'text-muted',
  danger: 'text-danger',
  accent: 'text-accent',
};

const ICON_CLASS = 'size-3.5';

const STATUS_LOOK: Record<ShowStatus, { tone: StatusTone; icon: ReactNode }> = {
  'Returning Series': {
    tone: 'success',
    icon: <CalendarPlus aria-hidden className={ICON_CLASS} />,
  },
  'In Production': { tone: 'success', icon: <Clapperboard aria-hidden className={ICON_CLASS} /> },
  Ended: { tone: 'default', icon: <Check aria-hidden className={ICON_CLASS} /> },
  Canceled: { tone: 'danger', icon: <X aria-hidden className={ICON_CLASS} /> },
  Planned: { tone: 'accent', icon: <Clock aria-hidden className={ICON_CLASS} /> },
  Pilot: { tone: 'accent', icon: <Clock aria-hidden className={ICON_CLASS} /> },
};

interface ShowStatusChipProps {
  status: ShowStatus;
  label: string;
}

export function ShowStatusChip({ status, label }: ShowStatusChipProps) {
  const { tone, icon } = STATUS_LOOK[status];

  return (
    <Chip size="md" variant="soft" color={tone} className="poster-glass shrink-0 gap-1.5 font-bold">
      <span className={`flex items-center ${TONE_ICON_COLOR[tone]}`}>{icon}</span>
      {label}
    </Chip>
  );
}
