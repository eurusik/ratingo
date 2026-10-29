import { MS_PER_DAY } from '../../../../common/constants';
import { BADGE_KEY, CARD_LIST_CONTEXT } from '../domain/card.constants';
import { CardEnrichmentService } from './card-enrichment.service';

describe('CardEnrichmentService.enrichCatalogItems', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const service = new CardEnrichmentService({ now: () => now } as never);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * MS_PER_DAY);

  const enrich = (item: Record<string, Date | null>) =>
    service.enrichCatalogItems([item], { context: CARD_LIST_CONTEXT.NEW_RELEASES_LIST, now })[0]
      .card.badgeKey;

  it('flags NEW_RELEASE for a recent past release', () => {
    expect(enrich({ releaseDate: daysFromNow(-3) })).toBe(BADGE_KEY.NEW_RELEASE);
  });

  it('ignores a future digital release when the theatrical release is recent', () => {
    expect(
      enrich({ theatricalReleaseDate: daysFromNow(-3), digitalReleaseDate: daysFromNow(40) }),
    ).toBe(BADGE_KEY.NEW_RELEASE);
  });

  it('does not flag NEW_RELEASE when every date is in the future', () => {
    expect(enrich({ releaseDate: daysFromNow(2), digitalReleaseDate: daysFromNow(40) })).toBeNull();
  });
});
