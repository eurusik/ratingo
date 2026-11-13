'use client';

import dynamic from 'next/dynamic';

export const DeferredToastRegion = dynamic(
  () => import('@heroui/react/toast').then(({ ToastProvider }) => ToastProvider),
  { ssr: false },
);
