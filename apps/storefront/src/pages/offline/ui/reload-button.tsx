'use client';

import { Button } from '@heroui/react';
import { RefreshCw } from 'lucide-react';

export function ReloadButton({ label }: { label: string }) {
  return (
    <Button size="lg" onPress={() => window.location.reload()}>
      <RefreshCw aria-hidden="true" className="size-4" />
      {label}
    </Button>
  );
}
