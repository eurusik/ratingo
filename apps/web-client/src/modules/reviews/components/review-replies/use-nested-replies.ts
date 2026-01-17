import { useMemo } from 'react';
import type { ReplyResponseDto } from '@/core/api/reviews.client';

interface NestedRepliesResult {
  topLevel: ReplyResponseDto[];
  childrenMap: Map<string, ReplyResponseDto[]>;
}

/**
 * Hook to build nested structure from flat replies list.
 * Groups replies by parent, separating top-level from nested.
 */
export function useNestedReplies(replies: ReplyResponseDto[] | undefined): NestedRepliesResult {
  return useMemo(() => {
    const topLevel: ReplyResponseDto[] = [];
    const childrenMap = new Map<string, ReplyResponseDto[]>();

    if (!replies) return { topLevel, childrenMap };

    for (const reply of replies) {
      if (!reply.parentReplyId) {
        topLevel.push(reply);
      } else {
        const siblings = childrenMap.get(reply.parentReplyId) || [];
        siblings.push(reply);
        childrenMap.set(reply.parentReplyId, siblings);
      }
    }

    return { topLevel, childrenMap };
  }, [replies]);
}
