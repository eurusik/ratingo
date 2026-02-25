const GENERIC_TITLE_RE = /^(Episode|Серія)\s+\d+$/i;
const TBA_RE = /^TB[AD]$/i;

/** Detects generic/placeholder episode titles that provide no useful information. */
export function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE_RE.test(title) || TBA_RE.test(title);
}
