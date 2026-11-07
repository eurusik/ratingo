import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Extracts current user from request (set by JwtStrategy).
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: unknown }>();
  return request.user ?? null;
});
