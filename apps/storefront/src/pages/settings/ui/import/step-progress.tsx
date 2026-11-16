import { cn } from '@ratingo/web-core/lib';

interface StepProgressProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function StepProgress({ current, total, label, className }: StepProgressProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div aria-hidden className="flex gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn('h-1 flex-1 rounded-full', index < current ? 'bg-accent' : 'bg-default')}
          />
        ))}
      </div>
      {label ? <p className="text-[13px] font-semibold text-muted">{label}</p> : null}
    </div>
  );
}
