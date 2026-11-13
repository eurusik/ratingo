import { BrandMark } from '@/shared/ui';
import { ConnectionRecovery } from './connection-recovery';

export function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col pt-safe-top pr-safe-right pb-safe-bottom pl-safe-left">
      <div
        translate="no"
        className="flex h-16 items-center justify-center gap-2 text-lg font-extrabold tracking-tight md:justify-start md:px-[var(--page-gutter)]"
      >
        <BrandMark />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <ConnectionRecovery />
      </div>
    </main>
  );
}
