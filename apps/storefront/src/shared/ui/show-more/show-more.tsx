'use client';

import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { useInfiniteSentinel } from '@/shared/lib';

interface ShowMoreProps {
  hasMore: boolean;
  isLoading?: boolean;
  label: string;
  loadingLabel: string;
  rearmKey: number;
  onMore: () => void;
}

export function ShowMore({
  hasMore,
  isLoading = false,
  label,
  loadingLabel,
  rearmKey,
  onMore,
}: ShowMoreProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const sentinelRef = useInfiniteSentinel({
    onReach: onMore,
    isEnabled: isScrolling && hasMore && !isLoading,
    rearmKey,
  });

  if (!hasMore) return null;

  if (isScrolling) {
    return (
      <div ref={sentinelRef} className="flex min-h-tap items-center justify-center">
        {isLoading ? <Spinner size="sm" aria-label={loadingLabel} /> : null}
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      isPending={isLoading}
      onPress={() => {
        setIsScrolling(true);
        onMore();
      }}
      className="min-h-tap self-center rounded-full px-5"
    >
      {label}
    </Button>
  );
}
