import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';

import { HealthReport, HealthService } from './health.service';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthReport> {
    const report = await this.healthService.check();
    if (report.status !== 'ok') {
      throw new AppException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Service dependencies are unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        report.checks,
      );
    }
    return report;
  }
}
