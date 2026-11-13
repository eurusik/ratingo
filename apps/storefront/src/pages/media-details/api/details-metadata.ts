import type { Metadata } from 'next';
import { movieMetadata, showMetadata } from '../model/details-seo';
import { loadMovie, loadShow } from './load-media-details';

export async function movieDetailsMetadata(slug: string): Promise<Metadata> {
  return movieMetadata(await loadMovie(slug), slug);
}

export async function showDetailsMetadata(slug: string): Promise<Metadata> {
  return showMetadata(await loadShow(slug), slug);
}
