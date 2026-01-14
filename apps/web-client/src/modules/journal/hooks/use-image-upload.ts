'use client';

/**
 * Hook for uploading images to journal posts.
 */

import { useState, useCallback } from 'react';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { journalApi } from '@/core/api/journal';
import type { ImageUploadResponseDto } from '../types';

/**
 * Upload state for tracking progress.
 */
export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: Error | null;
}

/**
 * Result of useImageUpload hook.
 */
export interface UseImageUploadResult {
  /** Upload a file and get the URL */
  upload: (file: File) => Promise<string>;
  /** Current upload state */
  state: UploadState;
  /** Reset state */
  reset: () => void;
  /** Underlying mutation for advanced usage */
  mutation: UseMutationResult<ImageUploadResponseDto, Error, File>;
}

/**
 * Hook for uploading images with progress tracking.
 *
 * @returns Upload function and state
 *
 * @example
 * const { upload, state } = useImageUpload();
 *
 * const handlePaste = async (file: File) => {
 *   const url = await upload(file);
 *   insertImageAtCursor(url);
 * };
 */
export function useImageUpload(): UseImageUploadResult {
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress(0);
      const result = await journalApi.uploadImage(file, (percent) => {
        setProgress(percent);
      });
      return result;
    },
    onError: () => {
      setProgress(0);
    },
  });

  const upload = useCallback(
    async (file: File): Promise<string> => {
      const result = await mutation.mutateAsync(file);
      return result.url;
    },
    [mutation],
  );

  const reset = useCallback(() => {
    setProgress(0);
    mutation.reset();
  }, [mutation]);

  const state: UploadState = {
    isUploading: mutation.isPending,
    progress,
    error: mutation.error,
  };

  return {
    upload,
    state,
    reset,
    mutation,
  };
}
