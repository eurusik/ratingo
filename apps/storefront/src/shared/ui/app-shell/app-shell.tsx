import type { ReactNode } from 'react';

export const MAIN_CONTENT_ID = 'main-content';

interface AppShellProps {
  header: ReactNode;
  tabBar: ReactNode;
  footer: ReactNode;
  overlays: ReactNode;
  skipToContentLabel: string;
  children: ReactNode;
}

export function AppShell({
  header,
  tabBar,
  footer,
  overlays,
  skipToContentLabel,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-safe-top focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-surface focus-visible:px-4 focus-visible:py-2"
      >
        {skipToContentLabel}
      </a>
      {header}
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex flex-1 flex-col pt-(--page-top) pb-[calc(var(--spacing-tab-bar)+var(--safe-bottom)+1.5rem)] outline-none md:page-container md:pb-0"
      >
        {children}
      </main>
      {footer}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-(--viewport-bottom-edge-height) bg-background md:hidden"
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:hidden [&>*]:pointer-events-auto">
        {tabBar}
      </div>
      {overlays}
    </div>
  );
}
