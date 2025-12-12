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
});
