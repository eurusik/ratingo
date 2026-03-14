'use client';

import { Check } from 'lucide-react';
import { cn } from '@/shared/utils/index';

type StepId = 'upload' | 'preview' | 'result';

interface ImportStepperProps {
  currentStep: StepId;
  labels: { files: string; preview: string; result: string };
}

const STEPS: { id: StepId; number: number; labelKey: keyof ImportStepperProps['labels'] }[] = [
  { id: 'upload', number: 1, labelKey: 'files' },
  { id: 'preview', number: 2, labelKey: 'preview' },
  { id: 'result', number: 3, labelKey: 'result' },
];

const STEP_ORDER: Record<StepId, number> = {
  upload: 0,
  preview: 1,
  result: 2,
};

export function ImportStepper({ currentStep, labels }: ImportStepperProps) {
  const currentIndex = STEP_ORDER[currentStep];

  return (
    <nav aria-label="Import progress">
      <ol role="list" className="flex items-start">
        {STEPS.map((step, index) => {
          const stepIndex = STEP_ORDER[step.id];
          const isCompleted = stepIndex < currentIndex;
          const isCurrent = step.id === currentStep;
          const isLast = index === STEPS.length - 1;

          return (
            <li
              key={step.id}
              className={cn('flex items-start', !isLast && 'flex-1')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold motion-safe:transition-colors',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent &&
                      'bg-cinema-elevated text-cinema-text-primary ring-2 ring-primary',
                    !isCompleted && !isCurrent && 'bg-cinema-elevated text-cinema-text-muted',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </span>
                <span className="hidden sm:block text-xs text-cinema-text-secondary whitespace-nowrap">
                  {labels[step.labelKey]}
                </span>
              </div>

              {/* Connecting line (not rendered after the last step) */}
              {!isLast && (
                <div className="mx-2 mt-4 h-0.5 flex-1 self-start">
                  <div
                    className={cn(
                      'h-full w-full motion-safe:transition-colors',
                      stepIndex < currentIndex ? 'bg-primary' : 'bg-cinema-border',
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
