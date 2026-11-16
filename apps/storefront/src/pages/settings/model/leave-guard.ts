'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { isPlainClick, previousRoutePath } from '@/shared/lib';

export type LeaveGuard = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

type LinkClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void;

export const LeaveGuardContext = createContext<RefObject<LeaveGuard | null> | null>(null);

function useLeaveGuard(guard: LeaveGuard | null): void {
  const guardRef = useContext(LeaveGuardContext);

  useEffect(() => {
    if (!guardRef) return;
    guardRef.current = guard;
    return () => {
      guardRef.current = null;
    };
  }, [guardRef, guard]);
}

export function useGuardedLink(): (href: string) => LinkClickHandler {
  const guardRef = useContext(LeaveGuardContext);
  return (href) => (event) => guardRef?.current?.(event, href);
}

export function useLeaveWarning(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isActive]);
}

export interface LeaveConfirmation {
  isAsking: boolean;
  stay: () => void;
  leave: () => void;
}

export function useLeaveConfirmation(isActive: boolean, onLeave?: () => void): LeaveConfirmation {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useLeaveGuard(
    isActive
      ? (event, href) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          setTarget(href);
        }
      : null,
  );

  const leave = () => {
    onLeave?.();
    setTarget(null);
    if (!target) return;
    if (previousRoutePath() === target) router.back();
    else router.push(target);
  };

  return { isAsking: target !== null, stay: () => setTarget(null), leave };
}
