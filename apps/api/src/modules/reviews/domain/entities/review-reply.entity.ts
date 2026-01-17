/**
 * Reply to a review (nested comment).
 */
export interface ReviewReply {
  id: string;
  reviewId: string;
  userId: string;
  parentReplyId: string | null;
  replyToUsername: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reply with author information for display.
 */
export interface ReviewReplyWithAuthor extends ReviewReply {
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
    isProfilePublic: boolean;
  };
}

/**
 * Input for creating a new reply.
 */
export interface CreateReplyInput {
  reviewId: string;
  userId: string;
  parentReplyId?: string | null;
  replyToUsername?: string | null;
  content: string;
}
