import { writeFile } from 'node:fs/promises';
import process from 'node:process';

/**
 * Candidate OpenAPI endpoints to try in order.
 *
 * Uses `RATINGO_OPENAPI_URL` if provided, otherwise derives URLs from `RATINGO_API_BASE_URL`.
 */
const CANDIDATE_URLS = (() => {
  const explicit = process.env.RATINGO_OPENAPI_URL;
  if (explicit) return [explicit];

  const base = process.env.RATINGO_API_BASE_URL || 'http://localhost:3001';
  return [`${base}/docs-json`, `${base}/api/docs-json`];
})();

/**
 * Fetch OpenAPI JSON from a running API instance.
 *
 * @returns {Promise<{ url: string, json: any }>} The first successful endpoint and parsed OpenAPI JSON.
 * @throws {Error} When none of the candidate URLs returns a valid OpenAPI document.
 */
async function fetchOpenApiJson() {
  const errors = [];

  const fetchFn = globalThis.fetch;
  if (!fetchFn) {
    throw new Error('Global fetch() is not available. Use Node 18+ or provide a polyfill.');
  }

  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetchFn(url, {
        headers: {
          accept: 'application/json',
        },
      });

      if (!res.ok) {
        errors.push(`${url} -> HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      return { url, json };
    } catch (err) {
      errors.push(`${url} -> ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Failed to fetch OpenAPI schema. Tried:\n- ${errors.join('\n- ')}`);
}

const { url, json } = await fetchOpenApiJson();
await writeFile(new globalThis.URL('../openapi.json', import.meta.url), JSON.stringify(json, null, 2) + '\n', 'utf8');

process.stdout.write(`OpenAPI schema saved from ${url} -> packages/api-contract/openapi.json\n`);
