'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button, Textarea } from '@/shared/ui';

const MAX_REPLY_LENGTH = 280;

interface ReviewReplyFormProps {
  onSubmit: (content: string, parentReplyId?: string, replyToUsername?: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  const charactersRemaining = MAX_REPLY_LENGTH - content.length;
  const isValid = content.trim().length > 0 && charactersRemaining >= 0;
  const hasContent = content.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    onSubmit(content.trim(), parentReplyId, replyToUsername);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        className={cn(
          'rounded-lg border border-cinema-borderSoft/60 bg-cinema-elevated/50 overflow-hidden',
          'transition-all duration-200',
          'hover:border-cinema-border/80',
          'focus-within:ring-2 focus-within:ring-cinema-focus/50 focus-within:border-transparent',
        )}
      >
          {/* Reply to indicator */}
          {replyToUsername && (
            <div className="px-3 pt-2 text-xs text-cinema-text-muted">
              {dict.reviews.replies.replyTo}{' '}
              <span className="text-cinema-text-secondary">@{replyToUsername}</span>
            </div>
          )}

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={dict.reviews.replies.placeholder}
            className={cn(
              'min-h-[50px] !border-0 !border-none bg-transparent resize-none text-sm overflow-hidden',
              'text-cinema-text-primary placeholder:text-cinema-text-disabled focus-visible:ring-0 shadow-none',
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
                    : 'text-cinema-text-disabled',
              )}
            >
              {content.length} / {MAX_REPLY_LENGTH}
            </span>

            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="h-8 text-cinema-text-muted hover:text-cinema-text-primary"
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
