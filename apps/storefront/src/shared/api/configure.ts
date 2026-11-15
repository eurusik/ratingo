import { configureApiClient } from '@ratingo/web-core/api';
import { API_BASE_URL, SERVER_API_BASE_URL } from '../config';

export function configureStorefrontApi(): void {
  const isServer = typeof window === 'undefined';
  configureApiClient({ baseUrl: isServer ? SERVER_API_BASE_URL : API_BASE_URL });
}
