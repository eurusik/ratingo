import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AdminJwtGuard } from '../../../auth/public';
import { KeyHealthService } from '../../application/services/key-health.service';
import {
  MONITORED_PROVIDERS,
  isMonitoredProvider,
} from '../../domain/constants/monitored-provider.const';
import {
  type KeyHealthSnapshot,
  type ProviderKeyHealth,
} from '../../domain/entities/key-health-snapshot.entity';
import { KEY_HEALTH_HISTORY_LIMIT } from '../../monitoring.constants';
import {
  KeyHealthDashboardDto,
  KeyHealthHistoryDto,
  KeyHealthHistoryQueryDto,
  KeyHealthSnapshotDto,
  ProviderKeyHealthDto,
} from '../dto';

function toSnapshotDto(snapshot: KeyHealthSnapshot): KeyHealthSnapshotDto {
  return {
    provider: snapshot.provider,
    status: snapshot.status,
    statusCode: snapshot.statusCode,
    latencyMs: snapshot.latencyMs,
    detail: snapshot.detail,
    quotaRemaining: snapshot.quotaRemaining,
    quotaLimit: snapshot.quotaLimit,
    checkedAt: snapshot.checkedAt.toISOString(),
  };
}

function toProviderDto(row: ProviderKeyHealth): ProviderKeyHealthDto {
  return {
    provider: row.provider,
    latest: row.latest ? toSnapshotDto(row.latest) : null,
    failures: {
      unauthorized: row.failures.unauthorized,
      rateLimited: row.failures.rateLimited,
    },
  };
}

@ApiTags('Admin Monitoring')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/monitoring')
export class MonitoringController {
  constructor(private readonly keyHealthService: KeyHealthService) {}

  @Get('keys')
  @ApiOperation({ summary: 'Current health of every monitored API key' })
  @ApiOkResponse({ type: KeyHealthDashboardDto })
  async getKeys(): Promise<KeyHealthDashboardDto> {
    const providers = await this.keyHealthService.getDashboard();
    return { providers: providers.map(toProviderDto) };
  }

  @Post('keys/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Probe all keys now and return the fresh dashboard' })
  @ApiOkResponse({ type: KeyHealthDashboardDto })
  async checkNow(): Promise<KeyHealthDashboardDto> {
    await this.keyHealthService.runChecks();
    const providers = await this.keyHealthService.getDashboard();
    return { providers: providers.map(toProviderDto) };
  }

  @Get('keys/:provider/history')
  @ApiOperation({ summary: 'Recent probe history for one provider' })
  @ApiParam({ name: 'provider', enum: MONITORED_PROVIDERS })
  @ApiOkResponse({ type: KeyHealthHistoryDto })
  async getHistory(
    @Param('provider') provider: string,
    @Query() query: KeyHealthHistoryQueryDto,
  ): Promise<KeyHealthHistoryDto> {
    if (!isMonitoredProvider(provider)) {
      throw new NotFoundException(`Unknown provider: ${provider}`);
    }

    const limit = query.limit ?? KEY_HEALTH_HISTORY_LIMIT;
    const items = await this.keyHealthService.getHistory(provider, limit);
    return { provider, items: items.map(toSnapshotDto) };
  }
}
