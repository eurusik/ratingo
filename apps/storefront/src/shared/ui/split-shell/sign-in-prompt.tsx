'use client';

import { Button } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { EMPTY_STATE_ACTION, EmptyState } from '../empty-state/empty-state';
import { SPLIT_SHELL_SIDE_PADDING } from './split-shell';

interface SignInPromptProps {
  title: string;
  text: string;
  action: string;
  onSignIn: () => void;
}

export function SignInPrompt({ title, text, action, onSignIn }: SignInPromptProps) {
  return (
    <div className={cn('flex flex-1 flex-col', SPLIT_SHELL_SIDE_PADDING)}>
      <EmptyState
        title={title}
        text={text}
        action={
          <Button className={EMPTY_STATE_ACTION} onPress={onSignIn}>
            {action}
          </Button>
        }
      />
    </div>
  );
}
