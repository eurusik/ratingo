export interface CatalogMediaRef {
  tmdbId: number;
  type: 'movie' | 'show';
}

export interface ReadyMedia extends CatalogMediaRef {
  mediaItemId: string;
}
