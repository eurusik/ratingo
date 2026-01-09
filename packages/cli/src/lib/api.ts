import type { components } from '@ratingo/api-contract';

export type PolicyConfig = components['schemas']['CreatePolicyDto'];
export type DryRunResponse = components['schemas']['DiffReportDto'];
export type RunStatus = components['schemas']['RunStatusDto'];

export interface ApiClientOptions {
  baseUrl: string;
  token: string;
}

export class ApiClient {
  constructor(private options: ApiClientOptions) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.options.baseUrl}${path}`;
    
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`API Error ${res.status}: ${error.error?.message || error.message}`);
    }

    return res.json();
  }

  async dryRunDiff(policy: PolicyConfig, options: { mode: string; limit: number }) {
    return this.request<{ data: DryRunResponse }>(
      'POST',
      '/admin/catalog-policies/dry-run/diff',
      { policy, options },
    );
  }

  async createPolicy(policy: PolicyConfig) {
    return this.request<{ data: { id: string; version: number; message: string } }>(
      'POST',
      '/admin/catalog-policies',
      policy,
    );
  }

  async preparePolicy(policyId: string) {
    return this.request<{ data: { runId: string; status: string } }>(
      'POST',
      `/admin/catalog-policies/${policyId}/prepare`,
      {},
    );
  }

  async getRunStatus(runId: string) {
    return this.request<{ data: RunStatus }>(
      'GET',
      `/admin/catalog-policies/runs/${runId}`,
    );
  }

  async promoteRun(runId: string) {
    return this.request<{ data: { status: string; message: string } }>(
      'POST',
      `/admin/catalog-policies/runs/${runId}/promote`,
      {},
    );
  }

  async listPolicies() {
    return this.request<{ data: { data: Array<{ id: string; version: string; status: string }> } }>(
      'GET',
      '/admin/catalog-policies',
    );
  }

  async listRuns() {
    return this.request<{ data: { data: Array<{ id: string; status: string; policyVersion: number }> } }>(
      'GET',
      '/admin/catalog-policies/runs',
    );
  }
}

import { getToken, loadConfig, clearToken, promptToken, saveConfig } from './auth.js';

export async function createClient(opts: { baseUrl?: string; token?: string }): Promise<ApiClient> {
  const config = loadConfig();
  const token = await getToken(opts.token);
  const baseUrl = opts.baseUrl || config.baseUrl || 'https://api.ratingo.top/api';
  
  const client = new ApiClient({ baseUrl, token });
  
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop as keyof ApiClient];
      if (typeof value !== 'function') return value;
      
      return async (...args: unknown[]) => {
        try {
          return await (value as (...args: unknown[]) => Promise<unknown>).apply(target, args);
        } catch (err) {
          if (err instanceof Error && err.message.includes('401')) {
            console.log('\nToken expired or invalid. Please enter a new token.');
            clearToken();
            const newToken = await promptToken();
            if (!newToken) throw new Error('Token is required');
            saveConfig({ ...config, token: newToken });
            
            const newClient = new ApiClient({ baseUrl, token: newToken });
            return await (newClient[prop as keyof ApiClient] as (...args: unknown[]) => Promise<unknown>)(...args);
          }
          throw err;
        }
      };
    },
  }) as ApiClient;
}
