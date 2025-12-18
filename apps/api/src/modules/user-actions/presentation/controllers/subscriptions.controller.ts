import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { SubscriptionsService } from '../../application/subscriptions.service';
import {
  SubscribeDto,
  UnsubscribeDto,
  SubscriptionWithMediaResponseDto,
  MediaSubscriptionStatusDto,
  SubscribeActionResultDto,
  UnsubscribeActionResultDto,
} from '../dto/subscriptions.dto';
import { SUBSCRIPTION_TRIGGER } from '../../domain/entities/user-subscription.entity';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Subscribes to notifications for a media item.
   */
  @Post(':mediaItemId')
  @ApiOperation({ summary: 'Subscribe to notifications for media item (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiCreatedResponse({
    type: SubscribeActionResultDto,
    description: 'Subscribed with current status',
  })
  async subscribe(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
    @Body() body: SubscribeDto,
  ): Promise<SubscribeActionResultDto> {
    const subscription = await this.subscriptionsService.subscribe({
      userId: user.id,
      mediaItemId,
      trigger: body.trigger,
      context: body.context,
      reasonKey: body.reasonKey,
    });

    const triggers = await this.subscriptionsService.getActiveTriggersForMedia(
      user.id,
      mediaItemId,
    );

    return {
      id: subscription.id,
      mediaItemId: subscription.mediaItemId,
      trigger: subscription.trigger,
      isActive: subscription.isActive,
      status: {
        triggers,
        hasRelease: triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
        hasNewSeason: triggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
        hasOnStreaming: triggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
      },
      createdAt: subscription.createdAt,
    };
  }

  /**
   * Unsubscribes from notifications for a media item.
   */
  @Delete(':mediaItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from notifications for media item (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({
    type: UnsubscribeActionResultDto,
    description: 'Unsubscribed with current status',
  })
  async unsubscribe(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
    @Body() body: UnsubscribeDto,
  ): Promise<UnsubscribeActionResultDto> {
    const unsubscribed = await this.subscriptionsService.unsubscribe(
      user.id,
      mediaItemId,
      body.trigger,
      body.context,
    );

    const triggers = await this.subscriptionsService.getActiveTriggersForMedia(
      user.id,
      mediaItemId,
    );

    return {
      unsubscribed,
      status: {
        triggers,
        hasRelease: triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
        hasNewSeason: triggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
        hasOnStreaming: triggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
      },
    };
  }

  /**
   * Gets subscription status for a media item.
   */
  @Get(':mediaItemId/status')
  @ApiOperation({ summary: 'Get subscription status for media item (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ type: MediaSubscriptionStatusDto })
  async getStatus(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
  ): Promise<MediaSubscriptionStatusDto> {
    const triggers = await this.subscriptionsService.getActiveTriggersForMedia(
      user.id,
      mediaItemId,
    );
    return {
      triggers,
      hasRelease: triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
      hasNewSeason: triggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
      hasOnStreaming: triggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
    };
  }

  /**
   * Lists active subscriptions.
   */
  @Get()
  @ApiOperation({ summary: 'List active subscriptions (auth: Bearer)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({ type: [SubscriptionWithMediaResponseDto] })
  async listActive(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const { total, data } = await this.subscriptionsService.listActiveWithMedia(
      user.id,
      limit ?? 20,
      offset ?? 0,
    );

    return {
      data,
      meta: {
        total,
        limit: limit ?? 20,
        offset: offset ?? 0,
        hasMore: (offset ?? 0) + data.length < total,
      },
    };
  }
}
