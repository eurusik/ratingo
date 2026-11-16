'use client';

import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import type { MainLibraryList } from '@/entities/library';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { BackToTop, EMPTY_STATE_ACTION, EmptyState, StatusBarBackdrop } from '@/shared/ui';
import { LibraryNav } from './library-nav';

const SHELL = 'flex flex-1 flex-col';

const SIDE_PADDING = 'px-4 md:px-0';

function SignInPrompt() {
  const { dict } = useTranslation();

  return (
    <div className={`flex flex-1 flex-col ${SIDE_PADDING}`}>
      <EmptyState
        title={dict.my.signIn.title}
        text={dict.my.signIn.text}
        action={
          <Button className={EMPTY_STATE_ACTION} onPress={() => openAuth({ mode: 'login' })}>
            {dict.my.signIn.action}
          </Button>
        }
      />
    </div>
  );
}

interface LibraryShellProps {
  current: MainLibraryList | 'notifications';
  header: ReactNode;
  skeleton: ReactNode;
  children: ReactNode;
}

export function LibraryShell({ current, header, skeleton, children }: LibraryShellProps) {
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) {
    return (
      <div className={SHELL}>
        {header}
        <SignInPrompt />
      </div>
    );
  }

  return (
    <div className={`${SHELL} gap-3 md:flex-row md:gap-0`}>
      <StatusBarBackdrop />
      <div className="hidden md:block md:pe-10">
        <div className="md:sticky md:top-16">
          <LibraryNav current={current} />
        </div>
      </div>
      <div className="flex min-w-0 max-w-[900px] flex-1 flex-col gap-3 md:border-s md:border-separator md:ps-10">
        {header}
        <div className={`flex flex-1 flex-col gap-3 ${SIDE_PADDING}`}>
          {isLoading ? skeleton : children}
        </div>
      </div>
      <BackToTop />
    </div>
  );
}
