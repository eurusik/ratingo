/**
 * Facebook Sign-In button component.
 *
 * Fetches OAuth configuration on mount and conditionally renders
 * based on whether Facebook OAuth is enabled.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui';
import { getApiUrl } from '@/core/config';
import { authApi } from '@/core/api';
import { useTranslation } from '@/shared/i18n';

/** Facebook "f" logo icon following brand guidelines. */
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

interface FacebookButtonProps {
  /** URL to redirect to after successful authentication. */
  returnTo?: string;
  /** Button mode - affects button text. */
  mode?: 'login' | 'register';
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Facebook Sign-In button that initiates OAuth flow.
 *
 * Automatically hides when Facebook OAuth is not configured on the backend.
 *
 * @example
 * <FacebookButton returnTo="/dashboard" mode="login" />
 */
export function FacebookButton({ returnTo, mode = 'login', className }: FacebookButtonProps) {
  const { dict } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    authApi
      .getAuthConfig()
      .then((config) => setEnabled(config.facebook?.enabled ?? false))
      .catch(() => setEnabled(false));
  }, []);

  // Don't render while loading or if disabled
  if (enabled === null || enabled === false) {
    return null;
  }

  const handleClick = () => {
    const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    window.location.href = getApiUrl(`auth/facebook${params}`);
  };

  const buttonText = mode === 'register' ? dict.auth.facebook.signUp : dict.auth.facebook.signIn;

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-700 ${className ?? ''}`}
      onClick={handleClick}
    >
      <FacebookIcon className="w-5 h-5" />
      {buttonText}
    </Button>
  );
}
