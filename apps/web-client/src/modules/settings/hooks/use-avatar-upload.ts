/**
 * React Query hook for avatar upload with presigned URL flow.
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type MeDto } from '@/core/api';

interface UploadAvatarVariables {
  file: File;
}

/**
 * Uploads avatar using presigned URL flow.
 * Gets presigned URL, uploads to S3, updates profile with new URL.
 */
export function useAvatarUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UploadAvatarVariables) => {
      const { file } = variables;

      // Step 1: Get presigned URL from backend
      let uploadData;
      try {
        uploadData = await usersApi.createAvatarUploadUrl({
          contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        });
      } catch (err) {
        console.error('[AvatarUpload] Failed to get presigned URL:', err);
        throw new Error('Failed to get upload URL');
      }

      // Step 2: Upload file to S3/R2
      let uploadResponse;
      try {
        uploadResponse = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });
      } catch (err) {
        console.error('[AvatarUpload] Network error during upload:', err);
        throw new Error('Network error during upload');
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => 'Unknown error');
        console.error('[AvatarUpload] S3 upload failed:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // Step 3: Update profile with new avatar URL
      const updateData = { avatarUrl: uploadData.publicUrl };
      return usersApi.updateProfile(updateData as Parameters<typeof usersApi.updateProfile>[0]);
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });

      const previousUser = queryClient.getQueryData<MeDto>(['auth', 'me']);

      if (previousUser) {
        const previewUrl = URL.createObjectURL(variables.file);
        queryClient.setQueryData<MeDto>(['auth', 'me'], {
          ...previousUser,
          avatarUrl: previewUrl,
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
