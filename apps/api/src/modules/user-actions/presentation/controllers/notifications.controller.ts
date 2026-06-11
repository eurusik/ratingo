import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiParam } from '@nestjs/swagger';

import { CurrentUser } from '../../../auth/public';
import { JwtAuthGuard } from '../../../auth/public';
import { NotificationsService } from '../../application/notifications.service';
import {
  NotificationListQueryDto,
  NotificationListResponseDto,
  UnreadCountResponseDto,
  MarkReadResponseDto,
} from '../dto/notifications.dto';

/**
 * Controller for user notifications.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Lists notifications for the current user.
   */
  @Get()
  @ApiOperation({ summary: 'List notifications (auth: Bearer)' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  async list(
    @CurrentUser() user: { id: string },
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    const result = await this.notificationsService.listWithMedia(
      user.id,
      query.limit,
      query.offset,
      query.unread,
    );
    return {
      data: result.data.map((n) => ({
        id: n.id,
        trigger: n.trigger,
        payload: n.payload,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        mediaSummary: n.mediaSummary,
      })),
      unreadCount: result.unreadCount,
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  /**
   * Gets unread notification count.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count (auth: Bearer)' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async getUnreadCount(@CurrentUser() user: { id: string }): Promise<UnreadCountResponseDto> {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount: count };
  }

  /**
   * Marks a notification as read.
   */
  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read (auth: Bearer)' })
  @ApiParam({ name: 'notificationId', type: String })
  @ApiOkResponse({ type: MarkReadResponseDto })
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<MarkReadResponseDto> {
    const success = await this.notificationsService.markAsRead(notificationId, user.id);
    return { success };
  }

  /**
   * Marks all notifications as read.
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read (auth: Bearer)' })
  @ApiOkResponse({ type: MarkReadResponseDto })
  async markAllAsRead(@CurrentUser() user: { id: string }): Promise<MarkReadResponseDto> {
    const count = await this.notificationsService.markAllAsRead(user.id);
    return { success: true, count };
  }
}
