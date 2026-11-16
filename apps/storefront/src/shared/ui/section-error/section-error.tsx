'use client';

import { Button, Card } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

interface SectionErrorProps {
  title: string;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function SectionError({ title, onRetry, isRetrying, className = '' }: SectionErrorProps) {
  const { dict } = useTranslation();

  return (
    <Card
      role="alert"
      className={`items-center justify-center gap-3 rounded-[20px] px-6 py-7 text-center ${className}`}
    >
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning"
      >
        <TriangleAlert className="size-5.5" />
      </span>
      <Card.Header className="items-center gap-1 p-0">
        <Card.Title className="text-base font-bold text-balance">{title}</Card.Title>
        <Card.Description className="text-sm text-pretty">
          {dict.common.sectionErrorHint}
        </Card.Description>
      </Card.Header>
      <Button
        variant="secondary"
        className="phone-tap-target text-foreground"
        isPending={isRetrying}
        onPress={onRetry}
      >
        {dict.common.retry}
      </Button>
    </Card>
  );
}
