export const DELEGATION_STORE = Symbol('DELEGATION_STORE');

export type InFlightClaim = { claimed: true } | { claimed: false; heldBy: string };

export const DeliveryClaimKind = {
  CLAIMED: 'claimed',
  SENDING: 'sending',
  SENT: 'sent',
} as const;

export type DeliveryClaim =
  | { kind: typeof DeliveryClaimKind.CLAIMED; partsSent: number }
  | { kind: typeof DeliveryClaimKind.SENDING }
  | { kind: typeof DeliveryClaimKind.SENT };

export interface DelegationStorePort {
  claimInFlight(chatId: string, requestId: string): Promise<InFlightClaim>;
  releaseInFlight(chatId: string, requestId: string): Promise<void>;
  claimDelivery(requestId: string): Promise<DeliveryClaim>;
  recordPartSent(requestId: string, partsSent: number): Promise<void>;
  confirmDelivery(requestId: string): Promise<void>;
  releaseDelivery(requestId: string): Promise<void>;
}
