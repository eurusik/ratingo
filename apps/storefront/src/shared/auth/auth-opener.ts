'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { forgetPendingIntent } from './pending-intent';

export type AuthMode = 'login' | 'register';

export interface AuthIntent {
  kind: 'save';
  title: string;
  mediaItemId: string;
}

export interface AuthRequest {
  mode: AuthMode;
  intent?: AuthIntent;
  onSignedIn?: () => void;
}

let currentRequest: AuthRequest | null = null;
const listeners = new Set<() => void>();

function publish(request: AuthRequest | null): void {
  currentRequest = request;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readRequest = () => currentRequest;
const readServerRequest = () => null;

export function openAuth({ mode = 'login', ...rest }: Partial<AuthRequest> = {}): void {
  publish({ mode, ...rest });
}

export function closeAuth(): void {
  forgetPendingIntent();
  publish(null);
}

export function useAuthRequest(): AuthRequest | null {
  return useSyncExternalStore(subscribe, readRequest, readServerRequest);
}

export function useSignedInAction(): (action: () => void, intent?: AuthIntent) => void {
  const { isAuthenticated } = useAuth();

  return useCallback(
    (action, intent) => {
      if (isAuthenticated) action();
      else openAuth({ intent, onSignedIn: action });
    },
    [isAuthenticated],
  );
}
