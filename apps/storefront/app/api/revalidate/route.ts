import { createRevalidateHandler } from '@/app/revalidate';
import { REVALIDATE_SECRET } from '@/shared/config/index.server';

export const POST = createRevalidateHandler(REVALIDATE_SECRET);
