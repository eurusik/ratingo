'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import type { MainLibraryList } from '@/entities/library';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { SignInPrompt, SplitShell } from '@/shared/ui';
import { LibraryNav } from './library-nav';

interface LibraryShellProps {
  current: MainLibraryList | 'notifications';
  header: ReactNode;
  skeleton: ReactNode;
  children: ReactNode;
}

export function LibraryShell({ current, header, skeleton, children }: LibraryShellProps) {
  const { dict } = useTranslation();
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <SignInPrompt {...dict.my.signIn} onSignIn={() => openAuth({ mode: 'login' })} />
      </div>
    );
  }

  return (
    <SplitShell nav={<LibraryNav current={current} />} header={header}>
      {isLoading ? skeleton : children}
    </SplitShell>
  );
}
