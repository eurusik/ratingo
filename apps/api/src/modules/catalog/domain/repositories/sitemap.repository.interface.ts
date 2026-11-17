export interface SitemapItem {
  slug: string;
  updatedAt: Date;
}

export interface ISitemapRepository {
  findReleasedMovies(releasedBy: Date): Promise<SitemapItem[]>;
  findReadyShows(): Promise<SitemapItem[]>;
}

export const SITEMAP_REPOSITORY = Symbol('SITEMAP_REPOSITORY');
