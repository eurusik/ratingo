'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { Check } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';

interface CheckButtonProps {
  label: string;
  onCheck: () => void;
}

export function CheckButton({ label, onCheck }: CheckButtonProps) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <Button
      isIconOnly
      variant="outline"
      aria-label={label}
      aria-pressed={isChecked}
      isDisabled={isChecked}
      onPress={() => {
        setIsChecked(true);
        onCheck();
      }}
      className={cn(
        'size-11 shrink-0 rounded-full border-2 border-muted',
        isChecked && 'border-accent bg-accent text-accent-foreground opacity-100',
      )}
    >
      <Check aria-hidden className="size-4.5" strokeWidth={2.6} />
    </Button>
  );
}
