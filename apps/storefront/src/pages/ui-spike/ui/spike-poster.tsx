import { ViewTransition } from 'react';
import { SPIKE_POSTER_TRANSITION } from '../model/sample-titles';

export function SpikePoster({ title, className }: { title: string; className: string }) {
  return (
    <ViewTransition name={SPIKE_POSTER_TRANSITION} share="morph" default="none">
      <div
        className={`flex items-end rounded-2xl bg-linear-to-br from-accent to-surface-tertiary p-3 font-semibold text-accent-foreground ${className}`}
      >
        {title}
      </div>
    </ViewTransition>
  );
}
