'use client';

import { useTranslation } from '@/shared/i18n';
import { ResponsiveDialog, type PressableElement } from '@/shared/ui';

export function SearchDialog({ trigger }: { trigger: PressableElement }) {
  const { dict } = useTranslation();

  return (
    <ResponsiveDialog trigger={trigger} title={dict.search.title}>
      <p className="text-muted">{dict.search.comingSoon}</p>
    </ResponsiveDialog>
  );
}
