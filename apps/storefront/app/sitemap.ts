import type { MetadataRoute } from 'next';
import { generateSitemap } from '@/app/seo';

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return generateSitemap();
}
