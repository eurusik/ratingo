'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';

interface WizardAction {
  label: string;
  onPress?: () => void;
  href?: string;
  isDisabled?: boolean;
  isPending?: boolean;
}

interface WizardActionsProps {
  hint?: string;
  primary: WizardAction;
  secondary?: WizardAction;
  showsSecondaryOnPhone?: boolean;
}

function ActionButton({
  action,
  variant,
  className,
}: {
  action: WizardAction;
  variant: 'primary' | 'outline' | 'ghost';
  className: string;
}) {
  if (action.href) {
    return (
      <Link
        href={action.href}
        className={cn(buttonVariants({ variant }), 'no-underline', className)}
      >
        {action.label}
      </Link>
    );
  }
  return (
    <Button
      variant={variant}
      onPress={action.onPress}
      isDisabled={action.isDisabled}
      isPending={action.isPending}
      className={className}
    >
      {action.label}
    </Button>
  );
}

export function WizardActions({
  hint,
  primary,
  secondary,
  showsSecondaryOnPhone = false,
}: WizardActionsProps) {
  return (
    <>
      <div
        className={cn(
          'z-10 flex flex-col gap-1 md:hidden',
          !showsSecondaryOnPhone &&
            'sticky bottom-[calc(var(--spacing-tab-bar)+var(--safe-bottom)+1.25rem)]',
        )}
      >
        <ActionButton
          action={primary}
          variant="primary"
          className="h-13 w-full rounded-full text-base font-bold shadow-overlay disabled:bg-default disabled:text-muted disabled:opacity-100"
        />
        {secondary && showsSecondaryOnPhone ? (
          <ActionButton
            action={secondary}
            variant="ghost"
            className="h-11 w-full rounded-full text-[15px] font-semibold text-accent"
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2.5 border-t border-separator pt-4 max-md:hidden">
        <p className="min-w-0 flex-1 text-sm text-muted">{hint}</p>
        {secondary ? (
          <ActionButton
            action={secondary}
            variant="outline"
            className="h-11 rounded-full px-4.5 font-semibold"
          />
        ) : null}
        <ActionButton
          action={primary}
          variant="primary"
          className="h-11 rounded-full px-5.5 font-bold"
        />
      </div>
    </>
  );
}
