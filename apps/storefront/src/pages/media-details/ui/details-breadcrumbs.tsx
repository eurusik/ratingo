'use client';

import { Breadcrumbs } from '@heroui/react';

interface Crumb {
  label: string;
  href?: string;
}

export function DetailsBreadcrumbs({ label, crumbs }: { label: string; crumbs: Crumb[] }) {
  return (
    <Breadcrumbs aria-label={label} className="hidden md:flex">
      {crumbs.map((crumb) => (
        <Breadcrumbs.Item key={crumb.label} href={crumb.href}>
          {crumb.label}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}
