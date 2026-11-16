'use client';

import { useRef, type ReactNode } from 'react';
import { Skeleton } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { SignInPrompt, SplitShell } from '@/shared/ui';
import { BackGuardContext, type BackGuard } from '../model/back-guard';
import type { SettingsSection } from '../model/settings-sections';
import { PhoneBar, SectionHeader } from './settings-headers';
import { SettingsNav } from './settings-nav';

const SKELETON_ROWS = 4;

function SettingsSkeleton() {
  const { dict } = useTranslation();

  return (
    <div role="status" aria-busy className="flex flex-col gap-3">
      <span className="sr-only">{dict.common.loading}</span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

interface SettingsShellProps {
  current: SettingsSection;
  phoneTitle: string;
  desktopTitle: string;
  backTo?: 'settings' | 'my';
  children: ReactNode;
}

export function SettingsShell({
  current,
  phoneTitle,
  desktopTitle,
  backTo,
  children,
}: SettingsShellProps) {
  const { dict } = useTranslation();
  const { user, isLoading } = useAuth();
  const backGuard = useRef<BackGuard | null>(null);
  const phoneBar = (
    <PhoneBar title={phoneTitle} backTo={backTo} onBack={(event) => backGuard.current?.(event)} />
  );

  if (!isLoading && !user) {
    return (
      <div className="flex flex-1 flex-col">
        {phoneBar}
        <SectionHeader title={desktopTitle} />
        <SignInPrompt {...dict.settings.signIn} onSignIn={() => openAuth({ mode: 'login' })} />
      </div>
    );
  }

  return (
    <BackGuardContext value={backGuard}>
      <SplitShell nav={<SettingsNav current={current} />} header={phoneBar}>
        {user ? (
          children
        ) : (
          <>
            <SectionHeader title={desktopTitle} />
            <SettingsSkeleton />
          </>
        )}
      </SplitShell>
    </BackGuardContext>
  );
}
