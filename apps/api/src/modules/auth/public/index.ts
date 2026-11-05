/**
 * Public API for auth module.
 *
 * This is the ONLY entry point for other modules to import from auth.
 *
 * @example
 * // ✅ Correct
 * import { JwtAuthGuard, CurrentUser } from '../auth/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
 */

// Decorators (leaf files first — keeps bindings available if a require cycle re-enters this barrel)
export { CurrentUser } from '../presentation/decorators/current-user.decorator';

// Guards
export { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
export { OptionalJwtAuthGuard } from '../presentation/guards/optional-jwt-auth.guard';
export { AdminJwtGuard } from '../presentation/guards/admin-jwt.guard';
