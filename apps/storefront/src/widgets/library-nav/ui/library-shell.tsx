'use client';

import type { ReactNode } from 'react';
import { Button, Card } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import type { LibraryList } from '@/entities/library';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { LibraryNav } from './library-nav';

const SHELL = 'flex flex-1 flex-col';

const SIDE_PADDING = 'px-4 md:px-0';

function SignInPrompt() {
  const { dict } = useTranslation();

  return (
    <div className={`flex flex-1 flex-col justify-center py-8 md:items-center ${SIDE_PADDING}`}>
      <Card className="gap-3 rounded-3xl p-4.5 md:w-full md:max-w-xl">
        <Card.Header className="gap-1.5 p-0">
          <Card.Title className="text-[17px] font-extrabold">{dict.my.signIn.title}</Card.Title>
          <Card.Description className="text-sm leading-relaxed">
            {dict.my.signIn.text}
          </Card.Description>
        </Card.Header>
        <Card.Footer className="p-0">
          <Button
            className="h-12 flex-1 rounded-full text-[15px] font-bold"
            onPress={() => openAuth({ mode: 'login' })}
          >
            {dict.my.signIn.action}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

interface LibraryShellProps {
  current: LibraryList | 'notifications';
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
    <div className={`${SHELL} gap-3 md:flex-row md:items-start md:gap-10`}>
      <div className="hidden md:block">
        <LibraryNav current={current} />
      </div>
      <div className="flex min-w-0 max-w-[860px] flex-1 flex-col gap-3">
        {header}
        <div className={`flex flex-col gap-3 ${SIDE_PADDING}`}>
          {isLoading ? skeleton : children}
        </div>
      </div>
    </div>
  );
}
