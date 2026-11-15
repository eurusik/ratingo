'use client';

import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import type { LibraryList } from '@/entities/library';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { LibraryNav } from './library-nav';

function SignInPrompt() {
  const { dict } = useTranslation();

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-16 text-center">
      <p className="text-lg font-extrabold">{dict.my.signIn.title}</p>
      <p className="text-sm text-muted">{dict.my.signIn.text}</p>
      <Button className="mt-3" onPress={() => openAuth()}>
        {dict.my.signIn.action}
      </Button>
    </div>
  );
}

interface LibraryShellProps {
  current: LibraryList | 'notifications';
  header: ReactNode;
  skeleton: ReactNode;
  children: ReactNode;
}

function ShellContent({ skeleton, children }: Pick<LibraryShellProps, 'skeleton' | 'children'>) {
  const { user, isLoading } = useAuth();
  if (isLoading) return skeleton;
  if (!user) return <SignInPrompt />;
  return children;
}

export function LibraryShell({ current, header, skeleton, children }: LibraryShellProps) {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:gap-10 md:px-0 md:pt-7">
      {user ? (
        <div className="hidden md:block">
          <LibraryNav current={current} />
        </div>
      ) : null}
      <div className="flex min-w-0 max-w-[860px] flex-1 flex-col gap-3">
        {header}
        <ShellContent skeleton={skeleton}>{children}</ShellContent>
      </div>
    </div>
  );
}
