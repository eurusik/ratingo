const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
