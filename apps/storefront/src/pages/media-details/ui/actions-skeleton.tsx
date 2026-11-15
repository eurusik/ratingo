import { Skeleton } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { ACTIONS_SKELETON_SIZE } from '../model/actions-skeleton-size';

export function ActionsSkeleton({ type }: { type: MediaType }) {
  return <Skeleton className={ACTIONS_SKELETON_SIZE[type]} />;
}
