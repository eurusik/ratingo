import fs from 'node:fs';
import path from 'node:path';
import { getDictionary } from '@/shared/i18n';

const STOREFRONT_ROOT = path.resolve(__dirname, '..');
export const APP_DIR = path.join(STOREFRONT_ROOT, 'app');

const NAMESPACES = new Set(Object.keys(getDictionary()));
const ROUTE_FILE = /^(page|layout|loading|error|not-found|template|global-error)\.tsx$/;
const USE_CLIENT = /^['"]use client['"]/m;
const NAMESPACE_READ = /\bdict\.([a-zA-Z]+)/g;
const UNTRACKABLE_READ = /\{[^}]*\}\s*=\s*dict\s*;|\bdict\[/;
const SCOPE = /<\w*TranslationScope\b[^>]*?namespaces=\{\[([^\]]*)\]\}/g;
const QUOTED_NAMESPACE = /'([a-zA-Z]+)'/g;
const STATIC_EDGE = /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const SIDE_EFFECT_IMPORT = /^\s*import\s+['"]([^'"]+)['"]/gm;

type Bindings =
  { kind: 'everything' } | { kind: 'named'; names: Array<[original: string, alias: string]> };

interface Edge {
  kind: 'import' | 'export';
  target: string;
  bindings: Bindings;
}

interface Visit {
  file: string;
  wanted: Bindings;
  onClient: boolean;
}

const EVERYTHING: Bindings = { kind: 'everything' };

function isTestFile(file: string): boolean {
  return file.includes('.test.');
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
  return found && !isTestFile(found) ? found : null;
}

function namedBindings(list: string): Bindings {
  const names = list
    .split(',')
    .map((binding) => binding.trim())
    .filter((binding) => binding && !binding.startsWith('type '))
    .map((binding): [string, string] => {
      const [original, alias] = binding.split(/\s+as\s+/).map((part) => part.trim());
      return [original, alias ?? original];
    });
  return { kind: 'named', names };
}

function importsDefaultOrNamespace(clause: string): boolean {
  const outsideBraces = clause.replace(/\{[\s\S]*\}/, '').trim();
  return outsideBraces.includes('*') || /^[A-Za-z_$]/.test(outsideBraces);
}

function bindingsOf(clause: string): Bindings {
  const braces = clause.match(/\{([\s\S]*)\}/);
  return braces && !importsDefaultOrNamespace(clause) ? namedBindings(braces[1]) : EVERYTHING;
}

function readEdges(file: string, source: string): Edge[] {
  const edges: Edge[] = [];
  for (const [, kind, typeOnly, clause, specifier] of source.matchAll(STATIC_EDGE)) {
    const target = resolveModule(file, specifier);
    if (!typeOnly && target)
      edges.push({ kind: kind as Edge['kind'], target, bindings: bindingsOf(clause) });
  }
  for (const pattern of [DYNAMIC_IMPORT, SIDE_EFFECT_IMPORT]) {
    for (const [, specifier] of source.matchAll(pattern)) {
      const target = resolveModule(file, specifier);
      if (target) edges.push({ kind: 'import', target, bindings: EVERYTHING });
    }
  }
  return edges;
}

function reexportedNames(edge: Edge, wanted: Bindings): Bindings | null {
  if (edge.bindings.kind === 'everything' || wanted.kind === 'everything') return wanted;
  const wantedNames = wanted.names.map(([original]) => original);
  const names = edge.bindings.names.filter(([, alias]) => wantedNames.includes(alias));
  return names.length ? { kind: 'named', names } : null;
}

function nextVisits(visit: Visit, edges: Edge[], onClient: boolean): Visit[] {
  return edges.flatMap((edge): Visit[] => {
    const wanted = edge.kind === 'import' ? edge.bindings : reexportedNames(edge, visit.wanted);
    return wanted ? [{ file: edge.target, wanted, onClient }] : [];
  });
}

function visitKey({ file, wanted, onClient }: Visit): string {
  const names = wanted.kind === 'everything' ? '*' : wanted.names.map(([name]) => name).join(',');
  return `${file}|${onClient}|${names}`;
}

export interface TranslationUsage {
  readOnClient: Set<string>;
  scoped: Set<string>;
  untrackableReads: string[];
}

export function scanTranslations(entry: string): TranslationUsage {
  const usage: TranslationUsage = {
    readOnClient: new Set(),
    scoped: new Set(),
    untrackableReads: [],
  };
  const seen = new Set<string>();
  const queue: Visit[] = [{ file: entry, wanted: EVERYTHING, onClient: false }];

  for (let visit = queue.pop(); visit; visit = queue.pop()) {
    const key = visitKey(visit);
    if (seen.has(key)) continue;
    seen.add(key);

    const source = fs.readFileSync(visit.file, 'utf8');
    const onClient = visit.onClient || USE_CLIENT.test(source);
    if (onClient) {
      for (const [, namespace] of source.matchAll(NAMESPACE_READ)) {
        if (NAMESPACES.has(namespace)) usage.readOnClient.add(namespace);
      }
      if (UNTRACKABLE_READ.test(source))
        usage.untrackableReads.push(path.relative(APP_DIR, visit.file));
    } else {
      for (const [, list] of source.matchAll(SCOPE)) {
        for (const [, namespace] of list.matchAll(QUOTED_NAMESPACE)) usage.scoped.add(namespace);
      }
    }
    queue.push(...nextVisits(visit, readEdges(visit.file, source), onClient));
  }

  return usage;
}

export function routeFiles(dir: string = APP_DIR): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return ROUTE_FILE.test(entry.name) ? [full] : [];
  });
}

export function enclosingLayouts(file: string): string[] {
  if (path.basename(file) === 'global-error.tsx') return [];
  const layouts: string[] = [];
  for (let dir = path.dirname(file); dir.startsWith(APP_DIR); dir = path.dirname(dir)) {
    const layout = path.join(dir, 'layout.tsx');
    if (layout !== file && fs.existsSync(layout)) layouts.push(layout);
  }
  return layouts;
}
