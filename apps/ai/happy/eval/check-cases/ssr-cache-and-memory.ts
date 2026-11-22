import { EvalKind, type EvalCase } from '../eval-case';

const CLIENT_PATH = 'packages/web-core/src/query/client.ts';

const clientLines = (gcTime: string): readonly string[] => [
  "import { QueryClient, isServer } from '@tanstack/react-query';",
  '',
  'const makeQueryClient = (): QueryClient =>',
  '  new QueryClient({',
  '    defaultOptions: {',
  '      queries: {',
  '        staleTime: 60 * 1000,',
  `        gcTime: ${gcTime},`,
  '        refetchOnWindowFocus: false,',
  '        retry: 1,',
  '        refetchOnMount: true,',
  '      },',
  '      mutations: {',
  '        retry: 0,',
  '      },',
  '    },',
  '  });',
  '',
  'let browserQueryClient: QueryClient | undefined;',
  '',
  'export function getQueryClient(): QueryClient {',
  '  if (isServer) {',
  '    return makeQueryClient();',
  '  }',
  '  browserQueryClient ??= makeQueryClient();',
  '  return browserQueryClient;',
  '}',
];

export const SSR_CACHE_AND_MEMORY_CASES: readonly EvalCase[] = [
  {
    id: 'ssr-cache-and-memory--positive',
    kind: EvalKind.POSITIVE,
    checkId: 'ssr-cache-and-memory',
    source:
      '08944dde~1:packages/web-core/src/query/client.ts (makeQueryClient written as an arrow expression, comments removed)',
    title: 'Shared TanStack query client factory',
    path: CLIENT_PATH,
    lines: clientLines('5 * 60 * 1000'),
    changed: { from: 'const makeQueryClient', to: 'let browserQueryClient' },
    expectation: {
      defectId: 'ssr-finite-gctime-on-server',
      markerLine: 'gcTime: 5 * 60 * 1000',
    },
  },
  {
    id: 'ssr-cache-and-memory--protected',
    kind: EvalKind.PROTECTED_NEGATIVE,
    checkId: 'ssr-cache-and-memory',
    source:
      'HEAD:packages/web-core/src/query/client.ts (makeQueryClient written as an arrow expression, comments removed)',
    title: 'Shared TanStack query client factory',
    path: CLIENT_PATH,
    lines: clientLines('isServer ? Infinity : 5 * 60 * 1000'),
    changed: { from: 'const makeQueryClient', to: 'let browserQueryClient' },
  },
];
