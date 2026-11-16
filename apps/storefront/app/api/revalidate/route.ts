import { createRevalidateHandler } from '@/app/revalidate';
import { REVALIDATE_SECRET } from '@/shared/config';

export const POST = createRevalidateHandler(REVALIDATE_SECRET);
