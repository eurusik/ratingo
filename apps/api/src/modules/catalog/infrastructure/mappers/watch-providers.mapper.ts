import { WatchProvidersMap, WatchProvider, WatchProviderRegion } from '../../../ingestion/domain/models/normalized-media.model';
import { WatchProviderRegionDto, WatchProviderDto } from '../../presentation/dtos/common.dto';
import { ImageMapper } from './image.mapper';

export class WatchProvidersMapper {
  static toDto(map: WatchProvidersMap | null): Record<string, WatchProviderRegionDto> | null {
    if (!map) return null;
    const result: Record<string, WatchProviderRegionDto> = {};
    for (const [country, region] of Object.entries(map)) {
      result[country] = this.mapRegion(region);
    }
    return result;
  }

  static getPrimary(map: WatchProvidersMap | null): WatchProviderRegionDto | null {
    if (!map) return null;
    
    // Priority: UA > US
    const ua = map['UA'];
    if (this.hasProviders(ua)) {
        return this.mapRegion(ua);
    }

    const us = map['US'];
    if (this.hasProviders(us)) {
        return this.mapRegion(us);
    }

    return null;
  }

  private static hasProviders(region?: WatchProviderRegion): boolean {
    if (!region) return false;
    return !!(
        region.flatrate?.length ||
        region.rent?.length ||
        region.buy?.length ||
        region.ads?.length ||
        region.free?.length
    );
  }

  private static mapRegion(region: WatchProviderRegion): WatchProviderRegionDto {
    return {
      link: region.link,
      stream: region.flatrate?.map(this.mapProvider),
      rent: region.rent?.map(this.mapProvider),
      buy: region.buy?.map(this.mapProvider),
      ads: region.ads?.map(this.mapProvider),
      free: region.free?.map(this.mapProvider),
    };
  }

  private static mapProvider = (p: WatchProvider): WatchProviderDto => {
    return {
      providerId: p.providerId,
      name: p.name,
      logo: ImageMapper.toPoster(p.logoPath), // Reusing poster logic for logos
      displayPriority: p.displayPriority,
    };
  }
}
