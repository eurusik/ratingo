export function WatchingNowBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-2 rounded-full bg-surface/60 px-3 text-[13px] font-semibold text-foreground tabular-nums backdrop-blur-xl">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-success ring-3 ring-success/25"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
