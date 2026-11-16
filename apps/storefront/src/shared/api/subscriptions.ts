import type { components } from '@ratingo/api-contract';
import { apiDelete, apiGet, apiPost } from '@ratingo/web-core/api';

export type SubscriptionTrigger = components['schemas']['SubscribeDto']['trigger'];
export type Subscription = components['schemas']['SubscriptionWithMediaResponseDto'];
type SubscribeResult = components['schemas']['SubscribeActionResultDto'];
type UnsubscribeResult = components['schemas']['UnsubscribeActionResultDto'];

export interface SubscriptionPage {
  data: Subscription[];
  meta: components['schemas']['OffsetPaginationMetaDto'];
}

export const subscriptionsApi = {
  list(query: { limit: number; offset: number }): Promise<SubscriptionPage> {
    return apiGet<SubscriptionPage>('me/subscriptions', { searchParams: { ...query } });
  },

  subscribe(
    mediaItemId: string,
    trigger: SubscriptionTrigger,
    context = 'reminder',
  ): Promise<SubscribeResult> {
    return apiPost<SubscribeResult>(`me/subscriptions/${mediaItemId}`, {
      trigger,
      context,
    } satisfies components['schemas']['SubscribeDto']);
  },

  unsubscribe(
    mediaItemId: string,
    trigger: SubscriptionTrigger,
    context = 'reminder',
  ): Promise<UnsubscribeResult> {
    return apiDelete<UnsubscribeResult>(`me/subscriptions/${mediaItemId}`, {
      json: { trigger, context } satisfies components['schemas']['UnsubscribeDto'],
    });
  },
} as const;
