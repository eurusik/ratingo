import type { MetadataRoute } from 'next';
import { IS_PRODUCTION_SITE, SITE_URL } from '@/shared/config';
import { buildRobots } from '@/shared/lib';

export default function robots(): MetadataRoute.Robots {
  return buildRobots(SITE_URL, IS_PRODUCTION_SITE);
}
