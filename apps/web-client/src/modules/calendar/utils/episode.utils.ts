const GENERIC_TITLE_RE = /^(Episode|Серія)\s+\d+$/i;
const TBA_RE = /^TB[AD]$/i;

/** Detects generic/placeholder episode titles that provide no useful information. */
export function isGenericTitle(title: string | null): boolean {
  return (
    title === null || title.trim() === '' || GENERIC_TITLE_RE.test(title) || TBA_RE.test(title)
  );
}
