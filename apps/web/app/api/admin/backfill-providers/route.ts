import { NextRequest } from 'next/server';
import { respondJson, respondError } from '@/lib/http/responses';
import { backfillProviderRegistryFromJoinTable } from '@/lib/sync/backfillProviders';

export async function GET(_req: NextRequest) {
  try {
    const res = await backfillProviderRegistryFromJoinTable();
    return respondJson({ ok: true, ...res });
  } catch (e: any) {
    return respondError(e?.message || 'Backfill failed', 500);
  }
}
