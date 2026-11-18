import path from 'node:path';
import { APP_DIR, enclosingLayouts, routeFiles, scanTranslations } from './translation-graph';

function namespacesScopedFor(file: string): Set<string> {
  return new Set(
    [file, ...enclosingLayouts(file)].flatMap((source) => [...scanTranslations(source).scoped]),
  );
}

const routes = routeFiles().map((file) => [path.relative(APP_DIR, file), file] as const);

describe('translation scopes', () => {
  it.each(routes)('%s ships every namespace its client components read', (_name, file) => {
    const scoped = namespacesScopedFor(file);
    const { readOnClient } = scanTranslations(file);

    expect([...readOnClient].filter((namespace) => !scoped.has(namespace))).toEqual([]);
  });

  it.each(routes)('%s reads the dictionary only through dict.<namespace>', (_name, file) => {
    expect(scanTranslations(file).untrackableReads).toEqual([]);
  });

  it('keeps the root scope small', () => {
    expect([...scanTranslations(path.join(APP_DIR, 'layout.tsx')).scoped]).toEqual(['common']);
  });
});
