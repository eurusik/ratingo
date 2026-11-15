'use client';

import { useRef, useState } from 'react';
import type { ReplyTarget } from './reply-thread';

export function useReplyTarget() {
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return {
    target,
    inputRef,
    pick: (next: ReplyTarget) => {
      setTarget(next);
      inputRef.current?.focus();
    },
    reset: () => setTarget(null),
  };
}
