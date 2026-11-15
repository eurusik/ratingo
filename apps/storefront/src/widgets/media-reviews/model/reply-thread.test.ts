import fc from 'fast-check';
import type { ReviewReply } from '@/shared/api';
import { replyDraftFor, toReplyThread } from './reply-thread';

const reply = (id: string, parentReplyId?: string) =>
  ({ id, parentReplyId, content: id, author: { username: id } }) as ReviewReply;

const replyLists = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { maxLength: 12 })
  .chain((ids) =>
    fc.tuple(
      fc.constant(ids),
      fc.array(fc.option(fc.constantFrom(...ids, 'missing'), { nil: undefined }), {
        minLength: ids.length,
        maxLength: ids.length,
      }),
    ),
  )
  .map(([ids, parents]) => ids.map((id, index) => reply(id, parents[index])));

describe('toReplyThread', () => {
  it('shows every reply exactly once, at most two levels deep', () => {
    fc.assert(
      fc.property(replyLists, (replies) => {
        const thread = toReplyThread(replies);
        const shown = thread.flatMap((branch) => [branch.reply, ...branch.answers]);
        expect(shown.map((item) => item.id).sort()).toEqual(replies.map((item) => item.id).sort());
      }),
    );
  });

  it('keeps deeper answers inside their top-level branch', () => {
    const thread = toReplyThread([reply('a'), reply('b', 'a'), reply('c', 'b')]);
    expect(thread).toHaveLength(1);
    expect(thread[0]?.answers.map((answer) => answer.id)).toEqual(['b', 'c']);
  });

  it('nests answers under their reply and treats orphans as top level', () => {
    const thread = toReplyThread([reply('a'), reply('b', 'a'), reply('c', 'gone')]);
    expect(thread.map((branch) => branch.reply.id)).toEqual(['a', 'c']);
    expect(thread[0]?.answers.map((answer) => answer.id)).toEqual(['b']);
  });
});

describe('replyDraftFor', () => {
  it('answers inside the branch and mentions the person', () => {
    expect(replyDraftFor('так', null)).toEqual({ content: 'так' });
    expect(replyDraftFor('так', { branchId: 'a', username: 'max' })).toEqual({
      content: 'так',
      parentReplyId: 'a',
      replyToUsername: 'max',
    });
  });
});
