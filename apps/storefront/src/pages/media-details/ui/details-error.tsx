'use client';

import { PageError } from '@/widgets/page-error';
import { BROWSE_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

interface DetailsErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function DetailsError({ error, onRetry }: DetailsErrorProps) {
  const { dict } = useTranslation();

  return (
    <PageError
      title={dict.details.error.title}
      text={dict.details.error.text}
      error={error}
      onRetry={onRetry}
      escape={{ href: BROWSE_ROUTE, label: dict.details.breadcrumb.browse }}
    />
  );
}
