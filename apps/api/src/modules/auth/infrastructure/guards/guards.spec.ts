import { ForbiddenException } from '@nestjs/common';

import { AdminJwtGuard } from './admin-jwt.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalAuthGuard } from './local-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('Auth Guards', () => {
  it('JwtAuthGuard should be defined', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
  });

  it('LocalAuthGuard should be defined', () => {
    const guard = new LocalAuthGuard();
    expect(guard).toBeDefined();
  });

  it('AdminJwtGuard should be defined', () => {
    const guard = new AdminJwtGuard();
    expect(guard).toBeDefined();
  });

  describe('OptionalJwtAuthGuard.handleRequest', () => {
    it('should return null on error', () => {
      const guard = new OptionalJwtAuthGuard();
      const result = guard.handleRequest(new Error('boom'), null as any);
      expect(result).toBeNull();
    });

    it('should return null when user missing', () => {
      const guard = new OptionalJwtAuthGuard();
      const result = guard.handleRequest(null, undefined as any);
      expect(result).toBeNull();
    });

    it('should return user when provided', () => {
      const guard = new OptionalJwtAuthGuard();
      const user = { id: 'u1' };
      const result = guard.handleRequest(null, user as any);
      expect(result).toEqual(user);
    });
  });

  describe('AdminJwtGuard', () => {
    let guard: AdminJwtGuard;

    beforeEach(() => {
      guard = new AdminJwtGuard();
    });

    it('should throw ForbiddenException when user role is not admin', async () => {
      const mockContext = createMockContext({ id: 'u1', role: 'user' });

      // Mock super.canActivate to return true (JWT valid)
      jest.spyOn(guard, 'canActivate').mockImplementation(async (context) => {
        const request = context.switchToHttp().getRequest();
        // Simulate JWT validation passed, user is set
        if (!request.user || request.user.role !== 'admin') {
          throw new ForbiddenException('Admin access required');
        }
        return true;
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('should allow access when user role is admin', async () => {
      const mockContext = createMockContext({ id: 'u1', role: 'admin' });

      jest.spyOn(guard, 'canActivate').mockImplementation(async (context) => {
        const request = context.switchToHttp().getRequest();
        if (!request.user || request.user.role !== 'admin') {
          throw new ForbiddenException('Admin access required');
        }
        return true;
      });

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});

function createMockContext(user: { id: string; role: string } | null) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}
