'use client';

import { PageError } from '@/widgets/page-error';
import { HOME_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

interface ErrorPageProps {
  error: unknown;
  onRetry: () => void;
}

export function ErrorPage({ error, onRetry }: ErrorPageProps) {
  const { dict } = useTranslation();

  return (
    <PageError
      title={dict.errorPage.title}
      text={dict.errorPage.text}
      error={error}
      onRetry={onRetry}
      escape={{ href: HOME_ROUTE, label: dict.common.toHome }}
    />
  );
}
