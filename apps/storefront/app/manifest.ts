import type { MetadataRoute } from 'next';
import { buildWebAppManifest } from '@/shared/lib';

export default function manifest(): MetadataRoute.Manifest {
  return buildWebAppManifest();
}
