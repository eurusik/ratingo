import type { MetadataRoute } from 'next';
import { generateSitemap } from '@/app/seo';

export const revalidate = 86400;

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return generateSitemap();
}
