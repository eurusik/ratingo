import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createMediaMetadata } from '@/shared/lib';
import { loadMovie, loadShow } from './load-media-details';

export async function movieDetailsMetadata(slug: string): Promise<Metadata> {
  const movie = await loadMovie(slug);
  if (!movie) notFound();
  return createMediaMetadata(movie, { type: 'movie', slug });
}

export async function showDetailsMetadata(slug: string): Promise<Metadata> {
  const show = await loadShow(slug);
  if (!show) notFound();
  return createMediaMetadata(show, { type: 'show', slug });
}
