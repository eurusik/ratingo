import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadMovieBySlug, loadShowBySlug } from '@/shared/api';
import { createMediaMetadata } from '@/shared/lib';

export async function movieDetailsMetadata(slug: string): Promise<Metadata> {
  const movie = await loadMovieBySlug(slug);
  if (!movie) notFound();
  return createMediaMetadata(movie, { type: 'movie', slug });
}

export async function showDetailsMetadata(slug: string): Promise<Metadata> {
  const show = await loadShowBySlug(slug);
  if (!show) notFound();
  return createMediaMetadata(show, { type: 'show', slug });
}
