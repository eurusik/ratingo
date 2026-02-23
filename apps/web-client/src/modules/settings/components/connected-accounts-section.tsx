/**
 * Connected OAuth accounts section for the settings security tab.
 * Shows linked providers with connect/disconnect functionality.
 */

'use client';

import { useState } from 'react';

import { Loader2 } from 'lucide-react';

import { useAuth, tokenStorage } from '@/core/auth';
import { getApiUrl } from '@/core/config';
import { useTranslation } from '@/shared/i18n';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  Button,
} from '@/shared/ui';

import { useUnlinkAccount } from '../hooks';

/** Google "G" logo icon following brand guidelines. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Facebook icon. */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#1877F2"
      />
    </svg>
  );
}

const PROVIDERS = [
  { id: 'google', name: 'Google', icon: GoogleIcon },
  { id: 'facebook', name: 'Facebook', icon: FacebookIcon },
] as const;

export function ConnectedAccountsSection() {
  const { dict } = useTranslation();
  const { user } = useAuth();
  const unlinkMutation = useUnlinkAccount();
  const [confirmProvider, setConfirmProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const linkedProviders = user.linkedProviders ?? [];
  const canUnlink = user.hasPassword || linkedProviders.length > 1;

  const t = dict.settings.connectedAccounts;

  const handleLink = (provider: string) => {
    const token = tokenStorage.getAccessToken();
    if (!token) return;
    const params = new URLSearchParams({ token, returnTo: '/settings' });
    window.location.href = getApiUrl(`auth/link/${provider}?${params.toString()}`);
  };

  const handleUnlink = async (provider: string) => {
    setError(null);
    try {
      await unlinkMutation.mutateAsync(provider);
      setConfirmProvider(null);
    } catch {
      setError(t.unlinkError);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-cinema-text-primary">{t.title}</h3>
        <p className="mt-1 text-sm text-cinema-text-muted">{t.description}</p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map(({ id, name, icon: Icon }) => {
          const isLinked = linkedProviders.includes(id);
          const isUnlinking = unlinkMutation.isPending && confirmProvider === id;

          return (
            <div
              key={id}
              className="flex items-center justify-between rounded-lg border border-cinema-border bg-cinema-card p-4"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-6 w-6" />
                <div>
                  <p className="font-medium text-cinema-text-primary">{name}</p>
                  {isLinked && (
                    <p className="text-xs text-cinema-text-muted">{t.connected}</p>
                  )}
                </div>
              </div>

              {isLinked ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canUnlink || isUnlinking}
                  onClick={() => setConfirmProvider(id)}
                  title={!canUnlink ? t.lastMethod : undefined}
                >
                  {isUnlinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.disconnect}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleLink(id)}>
                  {t.connect}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmProvider} onOpenChange={(open) => !open && setConfirmProvider(null)}>
        <AlertDialogContent className="border-cinema-border bg-cinema-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-cinema-text-primary">
              {t.confirmDisconnect}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cinema-text-muted">
              {t.confirmDisconnectDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-cinema-border bg-cinema-elevated text-cinema-text-primary hover:bg-cinema-elevated/80">
              {t.cancel}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => confirmProvider && handleUnlink(confirmProvider)}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.disconnect}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
