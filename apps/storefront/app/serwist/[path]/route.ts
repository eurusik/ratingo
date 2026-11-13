import { createSerwistRoute } from '@serwist/turbopack';
import { serviceWorkerRouteOptions } from '@/app/service-worker';

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute(serviceWorkerRouteOptions);
