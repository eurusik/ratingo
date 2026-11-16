'use client';

import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@ratingo/web-core/api';
import { accountApi } from '@/shared/api';

const FORBIDDEN_STATUS = 403;

export function isWrongPassword(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === FORBIDDEN_STATUS;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (change: Parameters<typeof accountApi.changePassword>[0]) =>
      accountApi.changePassword(change),
  });
}
