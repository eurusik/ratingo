/**
 * Public API for catalog-policy module.
 *
 * This is the ONLY entry point for other modules to import from catalog-policy.
 * Do NOT import directly from domain/ or application/ folders.
 *
 * @example
 * // ✅ Correct
 * import { ContentClass, classifyContent } from '../catalog-policy/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { ContentClass } from '../catalog-policy/domain/classification.service';
 */

// Domain types (Ubiquitous Language)
export {
  ContentClass,
  ContentClassValues,
  VALID_CONTENT_CLASSES,
  isValidContentClass,
  classifyContent,
  ClassificationInput,
} from '../domain/classification.service';
