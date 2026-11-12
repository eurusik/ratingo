import { Button } from '@heroui/react';

interface ModeSwitchProps {
  question: string;
  action: string;
  onPress: () => void;
}

export function ModeSwitch({ question, action, onPress }: ModeSwitchProps) {
  return (
    <p className="flex items-center justify-center gap-1 text-sm text-muted">
      {question}
      <Button variant="ghost" size="sm" className="font-semibold text-accent" onPress={onPress}>
        {action}
      </Button>
    </p>
  );
}
