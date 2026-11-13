import { ViewTransition } from 'react';
import { SPIKE_POSTER_TRANSITION } from '../model/sample-titles';

export function SpikePoster({ title, className }: { title: string; className: string }) {
  return (
    <div className={`relative ${className}`}>
      <ViewTransition name={SPIKE_POSTER_TRANSITION} share="morph" default="none">
        <div className="size-full rounded-2xl bg-linear-to-br from-accent to-surface-tertiary" />
      </ViewTransition>
      <span className="absolute inset-x-3 bottom-3 font-semibold text-accent-foreground">
        {title}
      </span>
    </div>
  );
}
