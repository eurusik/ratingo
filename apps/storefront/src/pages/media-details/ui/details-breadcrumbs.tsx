'use client';

import { Breadcrumbs } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { BROWSE_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { browseHrefFor } from '../model/details-routes';

export function DetailsBreadcrumbs({ type, title }: { type: MediaType; title: string }) {
  const { dict } = useTranslation();

  return (
    <Breadcrumbs aria-label={dict.details.breadcrumb.label} className="hidden md:flex">
      <Breadcrumbs.Item href={BROWSE_ROUTE}>{dict.details.breadcrumb.browse}</Breadcrumbs.Item>
      <Breadcrumbs.Item href={browseHrefFor(type)}>
        {dict.details.breadcrumb[type]}
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>{title}</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
