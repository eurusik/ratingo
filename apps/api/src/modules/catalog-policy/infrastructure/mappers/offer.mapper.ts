/**
 * Offer Mapper Utility
 *
 * Shared utility for mapping MediaWatchOfferView to NormalizedOffer.
 * Used by PolicyInputRepository and DryRunRepository.
 */

import { type NormalizedOffer } from '@/modules/catalog-policy/domain/types/policy.types';
import { type MediaWatchOfferView } from '@/modules/provider/public';

/**
 * Maps MediaWatchOfferView array to NormalizedOffer array for policy engine.
 *
 * @param offers - Array of MediaWatchOfferView from watchOffersRepository
 * @returns Array of NormalizedOffer for policy evaluation
 */
export function mapOffersToNormalized(offers: MediaWatchOfferView[]): NormalizedOffer[] {
  return offers.map((offer) => ({
    providerId: offer.providerId,
    offerType: offer.offerType,
    distributionChannel: offer.distributionChannel,
    isAdsTier: offer.variantIsAdsTier,
  }));
}

export function mapOffersByMediaItemToNormalized(
  offersByMediaItem: Map<string, MediaWatchOfferView[]>,
): Map<string, NormalizedOffer[]> {
  const normalizedOffersByMediaItem = new Map<string, NormalizedOffer[]>();
  for (const [mediaItemId, offers] of offersByMediaItem) {
    normalizedOffersByMediaItem.set(mediaItemId, mapOffersToNormalized(offers));
  }
  return normalizedOffersByMediaItem;
}
