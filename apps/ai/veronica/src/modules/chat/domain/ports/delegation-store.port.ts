export const DELEGATION_STORE = Symbol('DELEGATION_STORE');

export type InFlightClaim = { claimed: true } | { claimed: false; heldBy: string };

export interface DelegationStorePort {
  claimInFlight(chatId: string, requestId: string): Promise<InFlightClaim>;
  releaseInFlight(chatId: string, requestId: string): Promise<void>;
  claimDelivery(requestId: string): Promise<boolean>;
  confirmDelivery(requestId: string): Promise<void>;
  releaseDelivery(requestId: string): Promise<void>;
}
