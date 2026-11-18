import fs from 'node:fs';
import path from 'node:path';
import { getDictionary } from '@/shared/i18n';

const STOREFRONT_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(STOREFRONT_ROOT, 'app');
const NAMESPACES = new Set(Object.keys(getDictionary()));
const ROUTE_FILE = /^(page|layout|loading|error|not-found|template|global-error)\.tsx$/;
const USE_CLIENT = /^['"]use client['"]/m;
const DICTIONARY_ACCESS = /\bdict\.([a-zA-Z]+)/g;
const SCOPE = /<TranslationScope[^>]*?namespaces=\{\[([^\]]*)\]\}/g;
const STATIC_EDGE = /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const SIDE_EFFECT_IMPORT = /^\s*import\s+['"]([^'"]+)['"]/gm;

interface Edge {
  kind: 'import' | 'export';
  target: string;
  bindings: Array<[source: string, local: string]> | null;
  exportsAll: boolean;
}

interface Visit {
  file: string;
  wanted: string[] | null;
  client: boolean;
}

function resolveModule(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(STOREFRONT_ROOT, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  const found = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  return found && !found.includes('.test.') ? found : null;
}

function parseBindings(list: string): Array<[string, string]> {
  return list
    .split(',')
    .map((binding) => binding.trim())
    .filter((binding) => binding && !binding.startsWith('type '))
    .map((binding) => {
      const [source, local] = binding.split(/\s+as\s+/).map((part) => part.trim());
      return [source, local ?? source];
    });
}

function readEdges(file: string, source: string): Edge[] {
  const edges: Edge[] = [];
  for (const [, kind, typeOnly, clause, specifier] of source.matchAll(STATIC_EDGE)) {
    const target = resolveModule(file, specifier);
    if (typeOnly || !target) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    const hasDefaultOrNamespace = /\*|^[A-Za-z_$]/.test(clause.replace(/\{[\s\S]*\}/, '').trim());
    edges.push({
      kind: kind as Edge['kind'],
      target,
      bindings: named && !hasDefaultOrNamespace ? parseBindings(named[1]) : null,
      exportsAll: kind === 'export' && clause.trim() === '*',
    });
  }
  for (const pattern of [DYNAMIC_IMPORT, SIDE_EFFECT_IMPORT]) {
    for (const [, specifier] of source.matchAll(pattern)) {
      const target = resolveModule(file, specifier);
      if (target) edges.push({ kind: 'import', target, bindings: null, exportsAll: false });
    }
  }
  return edges;
}

function nextVisits(visit: Visit, edges: Edge[], client: boolean): Visit[] {
  return edges.flatMap((edge): Visit[] => {
    if (edge.kind === 'import') {
      return [
        { file: edge.target, wanted: edge.bindings?.map(([original]) => original) ?? null, client },
      ];
    }
    if (edge.exportsAll || !visit.wanted)
      return [{ file: edge.target, wanted: visit.wanted, client }];
    const wanted = (edge.bindings ?? [])
      .filter(([, exported]) => visit.wanted?.includes(exported))
      .map(([original]) => original);
    return wanted.length ? [{ file: edge.target, wanted, client }] : [];
  });
}

function scanTranslations(entry: string) {
  const usedOnClient = new Set<string>();
  const scoped = new Set<string>();
  const seen = new Set<string>();
  const queue: Visit[] = [{ file: entry, wanted: null, client: false }];

  while (queue.length) {
    const visit = queue.pop() as Visit;
    const key = `${visit.file}|${visit.client}|${visit.wanted?.join(',') ?? '*'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const source = fs.readFileSync(visit.file, 'utf8');
    const client = visit.client || USE_CLIENT.test(source);
    if (client) {
      for (const [, namespace] of source.matchAll(DICTIONARY_ACCESS)) {
        if (NAMESPACES.has(namespace)) usedOnClient.add(namespace);
      }
    } else {
      for (const [, list] of source.matchAll(SCOPE)) {
        for (const [, namespace] of list.matchAll(/'([a-zA-Z]+)'/g)) scoped.add(namespace);
      }
    }
    const edges = readEdges(visit.file, source);
    queue.push(...nextVisits(visit, edges, client));
  }

  return { usedOnClient, scoped };
}

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return ROUTE_FILE.test(entry.name) ? [full] : [];
  });
}

function enclosingLayouts(file: string): string[] {
  if (path.basename(file) === 'global-error.tsx') return [];
  const layouts: string[] = [];
  for (let dir = path.dirname(file); dir.startsWith(APP_DIR); dir = path.dirname(dir)) {
    const layout = path.join(dir, 'layout.tsx');
    if (layout !== file && fs.existsSync(layout)) layouts.push(layout);
  }
  return layouts;
}

const routes = routeFiles(APP_DIR).map((file) => [path.relative(APP_DIR, file), file] as const);

describe('translation scopes', () => {
  it.each(routes)('%s ships every namespace its client components read', (_name, file) => {
    const provided = new Set(
      [file, ...enclosingLayouts(file)].flatMap((source) => [...scanTranslations(source).scoped]),
    );
    const missing = [...scanTranslations(file).usedOnClient].filter(
      (namespace) => !provided.has(namespace),
    );

    expect(missing).toEqual([]);
  });

  it('keeps the root scope small', () => {
    expect([...scanTranslations(path.join(APP_DIR, 'layout.tsx')).scoped]).toEqual(['common']);
  });
});
