'use client';

import { Button } from '@heroui/react';
import { Check } from 'lucide-react';

interface CheckButtonProps {
  label: string;
  onCheck: () => void;
}

export function CheckButton({ label, onCheck }: CheckButtonProps) {
  return (
    <Button
      isIconOnly
      variant="outline"
      aria-label={label}
      onPress={onCheck}
      className="size-11 shrink-0 rounded-full border-2 border-muted hover:border-accent"
    >
      <Check aria-hidden className="size-4.5" strokeWidth={2.6} />
    </Button>
  );
}
