import type { ReplyDraft, ReviewReply } from '@/shared/api';

export interface ReplyBranch {
  reply: ReviewReply;
  answers: ReviewReply[];
}

function rootIdOf(reply: ReviewReply, byId: ReadonlyMap<string, ReviewReply>): string {
  const seen = new Set<string>();
  let current = reply;
  while (current.parentReplyId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentReplyId);
    if (!parent) break;
    current = parent;
  }
  return current.id;
}

export function toReplyThread(replies: readonly ReviewReply[]): ReplyBranch[] {
  const byId = new Map(replies.map((reply) => [reply.id, reply]));
  const branches = new Map<string, ReplyBranch>();

  for (const reply of replies) {
    const rootId = rootIdOf(reply, byId);
    const root = byId.get(rootId) ?? reply;
    const branch = branches.get(rootId) ?? { reply: root, answers: [] };
    if (reply.id !== rootId) branch.answers.push(reply);
    branches.set(rootId, branch);
  }

  return [...branches.values()];
}

export interface ReplyTarget {
  branchId: string;
  username: string;
}

export function replyDraftFor(content: string, target: ReplyTarget | null): ReplyDraft {
  if (!target) return { content };
  return { content, parentReplyId: target.branchId, replyToUsername: target.username };
}
