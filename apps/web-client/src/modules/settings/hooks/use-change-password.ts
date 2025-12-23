/**
 * React Query hook for changing user password.
 */

'use client';

import { useMutation } from '@tanstack/react-query';
import { usersApi, type ChangePasswordDto } from '@/core/api';

/**
 * Changes user password.
 * Handle 403 errors (wrong password) separately in component.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordDto) => usersApi.changePassword(data),
  });
}
