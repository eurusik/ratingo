'use client';

import { Breadcrumbs } from '@heroui/react';

interface Crumb {
  label: string;
  href?: string;
}

export function DetailsBreadcrumbs({ label, crumbs }: { label: string; crumbs: Crumb[] }) {
  return (
    <Breadcrumbs aria-label={label} className="hidden min-w-0 md:flex">
      {crumbs.map((crumb) => (
        <Breadcrumbs.Item
          key={crumb.href ?? 'current'}
          href={crumb.href}
          className={crumb.href ? undefined : 'min-w-0'}
        >
          <span className="truncate">{crumb.label}</span>
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}
