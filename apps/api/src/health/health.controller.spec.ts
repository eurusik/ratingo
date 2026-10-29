import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';

import { HealthController } from './health.controller';
import { type HealthReport, type HealthService } from './health.service';

describe('HealthController', () => {
  const createController = (report: HealthReport) => {
    const healthService = {
      check: jest.fn().mockResolvedValue(report),
    } as unknown as HealthService;
    return new HealthController(healthService);
  };

  it('returns the report when all dependencies are up', async () => {
    const report: HealthReport = { status: 'ok', checks: { database: 'up', redis: 'up' } };

    await expect(createController(report).check()).resolves.toEqual(report);
  });

  it('throws 503 with dependency statuses when a dependency is down', async () => {
    const report: HealthReport = { status: 'error', checks: { database: 'down', redis: 'up' } };

    const error = await createController(report)
      .check()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect((error as AppException).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect((error as AppException).details).toEqual({ database: 'down', redis: 'up' });
  });
});
