export function WatchingNowBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-2 poster-glass rounded-full px-3 text-[13px] font-semibold tabular-nums">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-success ring-3 ring-success/25"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
