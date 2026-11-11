import { configureApiClient } from '@ratingo/web-core/api';
import { API_BASE_URL } from '../config';

export function configureStorefrontApi(): void {
  configureApiClient({ baseUrl: API_BASE_URL });
}
