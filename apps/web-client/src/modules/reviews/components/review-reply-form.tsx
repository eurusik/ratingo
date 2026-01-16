'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button, Textarea } from '@/shared/ui';

const MAX_REPLY_LENGTH = 280;

interface ReviewReplyFormProps {
  onSubmit: (content: string, parentReplyId?: string) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  parentReplyId?: string;
  replyToUsername?: string;
  autoFocus?: boolean;
}

export function ReviewReplyForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  parentReplyId,
  replyToUsername,
  autoFocus = false,
}: ReviewReplyFormProps) {
  const { dict } = useTranslation();
  const [content, setContent] = useState('');

  const charactersRemaining = MAX_REPLY_LENGTH - content.length;
  const isValid = content.trim().length > 0 && charactersRemaining >= 0;
  const hasContent = content.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    onSubmit(content.trim(), parentReplyId);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
          {/* Reply to indicator */}
          {replyToUsername && (
            <div className="px-3 pt-2 text-xs text-zinc-500">
              {dict.reviews.replies.replyTo}{' '}
              <span className="text-zinc-400">@{replyToUsername}</span>
            </div>
          )}

          {/* Textarea */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={dict.reviews.replies.placeholder}
            className={cn(
              'min-h-[50px] border-0 bg-transparent resize-none text-sm',
              'text-zinc-200 placeholder-zinc-500 focus-visible:ring-0',
            )}
            disabled={isSubmitting}
            autoFocus={autoFocus}
          />

          {/* Bottom bar with actions */}
          <div className="flex items-center justify-between px-3 pb-2">
            <span
              className={cn(
                'text-xs',
                charactersRemaining < 0
                  ? 'text-red-500'
                  : charactersRemaining < 30
                    ? 'text-yellow-500'
                    : 'text-zinc-600',
              )}
            >
              {charactersRemaining}
            </span>

            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="h-8 text-zinc-400 hover:text-zinc-200"
                >
                  {dict.reviews.replies.cancel}
                </Button>
              )}

              {/* Submit button appears only when typing */}
              {hasContent && (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!isValid || isSubmitting}
                  className="h-8 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? dict.reviews.replies.submitting : dict.reviews.replies.submit}
                </Button>
              )}
            </div>
          </div>
        </div>
    </form>
  );
}
