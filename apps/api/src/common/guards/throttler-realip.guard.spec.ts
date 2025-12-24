import { ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerRealIpGuard } from './throttler-realip.guard';
import { ThrottlerLimitDetail } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Test the extractRealIp function indirectly through the guard
describe('ThrottlerRealIpGuard', () => {
  let guard: ThrottlerRealIpGuard;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    const mockOptions = { ttl: 60, limit: 10 };
    const mockStorage = { increment: jest.fn(), reset: jest.fn() };
    const mockReflector = new Reflector();

    guard = new ThrottlerRealIpGuard(mockOptions as any, mockStorage as any, mockReflector);
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTracker', () => {
    it('should extract IP from cf-connecting-ip header', async () => {
      const req = {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const result = await guard['getTracker'](req);
      expect(result).toBe('1.2.3.4');
    });

    it('should extract IP from x-forwarded-for header when cf-connecting-ip is missing', async () => {
      const req = {
        headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const result = await guard['getTracker'](req);
      expect(result).toBe('5.6.7.8');
    });

    it('should use fastify computed IP when proxy headers are missing', async () => {
      const req = {
        headers: {},
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const result = await guard['getTracker'](req);
      expect(result).toBe('192.168.1.1');
    });

    it('should use raw socket IP when fastify IP is missing', async () => {
      const req = {
        headers: {},
        ip: undefined,
        raw: { socket: { remoteAddress: '10.0.0.1' } },
      } as any;

      const result = await guard['getTracker'](req);
      expect(result).toBe('10.0.0.1');
    });

    it('should return "unknown" when no IP is available', async () => {
      const req = {
        headers: {},
        ip: undefined,
        raw: {},
      } as any;

      const result = await guard['getTracker'](req);
      expect(result).toBe('unknown');
    });

    it('should trim whitespace from cf-connecting-ip', async () => {
      const req = {
        headers: { 'cf-connecting-ip': '  1.2.3.4  ' },
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const result = await guard['getTracker'](req);
      expect(result).toBe('1.2.3.4');
    });

    it('should ignore empty cf-connecting-ip header', async () => {
      const req = {
        headers: { 'cf-connecting-ip': '   ', 'x-forwarded-for': '5.6.7.8' },
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const result = await guard['getTracker'](req);
      expect(result).toBe('5.6.7.8');
    });
  });

  describe('generateKey', () => {
    it('should generate key with IP from request', () => {
      const req = {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as ExecutionContext;

      const result = guard['generateKey'](context, 'suffix', 'tier');
      expect(result).toBe('tier:1.2.3.4:suffix');
    });
  });

  describe('throwThrottlingException', () => {
    it('should add rate limit headers and log warning', async () => {
      const req = {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const response = {
        header: jest.fn(),
      } as any as FastifyReply;

      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => response,
        }),
      } as ExecutionContext;

      const throttlerDetail: ThrottlerLimitDetail = {
        limit: 10,
        timeToExpire: 60000,
        key: 'default:1.2.3.4:60',
        tracker: '1.2.3.4',
        totalHits: 11,
        ttl: 60,
        isBlocked: true,
        timeToBlockExpire: 60000,
      };

      // Mock the parent method to avoid actual exception throwing
      const parentThrowSpy = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'throwThrottlingException')
        .mockImplementation(() => Promise.resolve());

      await guard['throwThrottlingException'](context, throttlerDetail);

      // Verify headers were set
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Tier', 'default');
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Key', 'default:1.2.3.4:60');
      expect(response.header).toHaveBeenCalledWith('Retry-After', '60');

      // Verify logging
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded: GET /api/test'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('tier=default'));
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('ip=1.2.3.4'));

      parentThrowSpy.mockRestore();
    });

    it('should handle unknown tier when key format is unexpected', async () => {
      const req = {
        headers: {},
        method: 'POST',
        url: '/api/test',
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      const response = {
        header: jest.fn(),
      } as any as FastifyReply;

      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => response,
        }),
      } as ExecutionContext;

      const throttlerDetail: ThrottlerLimitDetail = {
        limit: 5,
        timeToExpire: 30000,
        key: 'malformed-key',
        tracker: '192.168.1.1',
        totalHits: 6,
        ttl: 30,
        isBlocked: true,
        timeToBlockExpire: 30000,
      };

      const parentThrowSpy = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'throwThrottlingException')
        .mockImplementation(() => Promise.resolve());

      await guard['throwThrottlingException'](context, throttlerDetail);

      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Tier', 'malformed-key');
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('tier=malformed-key'));

      parentThrowSpy.mockRestore();
    });
  });
});
