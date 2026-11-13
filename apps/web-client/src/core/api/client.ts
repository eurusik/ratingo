import { configureApiClient } from '@ratingo/web-core/api';
import { env } from '../config/env';

export function configureWebClientApi(): void {
  configureApiClient({ baseUrl: env.API_BASE_URL });
}

configureWebClientApi();

export { apiGet, apiPost, apiPatch, apiPut, apiDelete, type ApiResponse } from '@ratingo/web-core/api';
