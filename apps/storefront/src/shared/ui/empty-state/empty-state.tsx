import type { ReactNode } from 'react';
import { Card } from '@heroui/react';

export const EMPTY_STATE_ACTION = 'h-12 flex-1 rounded-full text-[15px] font-bold no-underline';

interface EmptyStateProps {
  title: string;
  text?: string;
  action?: ReactNode;
}

export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col justify-center py-8 md:items-center">
      <Card className="gap-3 rounded-3xl p-4.5 md:w-full md:max-w-xl">
        <Card.Header className="gap-1.5 p-0">
          <Card.Title className="text-[17px] font-extrabold">{title}</Card.Title>
          {text ? (
            <Card.Description className="text-sm leading-relaxed">{text}</Card.Description>
          ) : null}
        </Card.Header>
        {action ? <Card.Footer className="flex gap-2 p-0">{action}</Card.Footer> : null}
      </Card>
    </div>
  );
}
