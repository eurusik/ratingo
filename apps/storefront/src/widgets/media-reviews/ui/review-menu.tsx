'use client';

import { Dropdown, Label, type Key } from '@heroui/react';
import { Ellipsis } from 'lucide-react';
import type { Review } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { useReviewsActions } from './reviews-context';

export function ReviewMenu({ review, isOwn }: { review: Review; isOwn: boolean }) {
  const { dict } = useTranslation();
  const actions = useReviewsActions();
  const runSignedIn = useSignedInAction();

  const onAction = (key: Key) => {
    if (key === 'edit') actions.compose(review);
    if (key === 'delete') actions.remove(review);
    if (key === 'report') runSignedIn(() => actions.report(review));
  };

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={dict.reviews.card.menu}
        className="-me-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Ellipsis aria-hidden className="size-5" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu aria-label={dict.reviews.card.menu} onAction={onAction}>
          {isOwn ? (
            <>
              <Dropdown.Item id="edit" textValue={dict.reviews.card.edit}>
                <Label>{dict.reviews.card.edit}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="delete" variant="danger" textValue={dict.reviews.card.delete}>
                <Label>{dict.reviews.card.delete}</Label>
              </Dropdown.Item>
            </>
          ) : (
            <Dropdown.Item id="report" variant="danger" textValue={dict.reviews.card.report}>
              <Label>{dict.reviews.card.report}</Label>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
