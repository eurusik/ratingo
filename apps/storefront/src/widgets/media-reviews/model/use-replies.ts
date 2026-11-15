'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi, type ReplyDraft } from '@/shared/api';
import { refreshMediaReviews } from './review-cache';
import { repliesKey } from './review-keys';
import { toReplyThread } from './reply-thread';

export function useReplyThread(reviewId: string) {
  const query = useQuery({
    queryKey: repliesKey(reviewId),
    queryFn: () => reviewsApi.listReplies(reviewId),
  });
  const thread = useMemo(() => toReplyThread(query.data ?? []), [query.data]);
  return { query, thread };
}

export function useSendReply(reviewId: string, mediaItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ReplyDraft) => reviewsApi.createReply(reviewId, draft),
    onSuccess: async () => {
      refreshMediaReviews(queryClient, mediaItemId);
      await queryClient.invalidateQueries({ queryKey: repliesKey(reviewId) });
    },
    onError: (error) => console.error('Sending a reply failed', { reviewId, error }),
  });
}
