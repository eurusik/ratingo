/**
 * React Query hook for updating user profile with optimistic updates.
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type UpdateProfileDto, type MeDto } from '@/core/api';

/**
 * Updates user profile with optimistic updates.
 * Reverts on error, invalidates cache on success.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileDto) => usersApi.updateProfile(data),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });

      const previousUser = queryClient.getQueryData<MeDto>(['auth', 'me']);

      if (previousUser) {
        queryClient.setQueryData<MeDto>(['auth', 'me'], {
          ...previousUser,
          username: variables.username ?? previousUser.username,
          profile: {
            ...previousUser.profile,
            ...variables,
          },
        });
      }

      return { previousUser };
    },

    onSuccess: (data) => {
      queryClient.setQueryData<MeDto>(['auth', 'me'], data);
    },

    onError: (_error, _variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(['auth', 'me'], context.previousUser);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
