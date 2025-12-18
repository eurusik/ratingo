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
import { SavedItemsService } from '../../application/saved-items.service';
import {
  SaveItemDto,
  UnsaveItemDto,
  SavedItemWithMediaResponseDto,
  MediaSaveStatusDto,
  SaveActionResultDto,
  UnsaveActionResultDto,
} from '../dto/saved-items.dto';
import { SAVED_ITEM_LIST, SavedItemList } from '../../domain/entities/user-saved-item.entity';

@ApiTags('Saved Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/saved-items')
export class SavedItemsController {
  constructor(private readonly savedItemsService: SavedItemsService) {}

  /**
   * Saves a media item to a list.
   */
  @Post(':mediaItemId')
  @ApiOperation({ summary: 'Save media item to a list (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiCreatedResponse({ type: SaveActionResultDto, description: 'Item saved with current status' })
  async saveItem(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
    @Body() body: SaveItemDto,
  ): Promise<SaveActionResultDto> {
    const item = await this.savedItemsService.saveItem({
      userId: user.id,
      mediaItemId,
      list: body.list,
      context: body.context,
      reasonKey: body.reasonKey,
    });

    const lists = await this.savedItemsService.getListsForMedia(user.id, mediaItemId);

    return {
      id: item.id,
      mediaItemId: item.mediaItemId,
      list: item.list,
      status: {
        isForLater: lists.includes(SAVED_ITEM_LIST.FOR_LATER),
        isConsidering: lists.includes(SAVED_ITEM_LIST.CONSIDERING),
      },
      createdAt: item.createdAt,
    };
  }

  /**
   * Removes a media item from a list.
   */
  @Delete(':mediaItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove media item from a list (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ type: UnsaveActionResultDto, description: 'Item removed with current status' })
  async unsaveItem(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
    @Body() body: UnsaveItemDto,
  ): Promise<UnsaveActionResultDto> {
    const removed = await this.savedItemsService.unsaveItem(
      user.id,
      mediaItemId,
      body.list,
      body.context,
    );

    const lists = await this.savedItemsService.getListsForMedia(user.id, mediaItemId);

    return {
      removed,
      status: {
        isForLater: lists.includes(SAVED_ITEM_LIST.FOR_LATER),
        isConsidering: lists.includes(SAVED_ITEM_LIST.CONSIDERING),
      },
    };
  }

  /**
   * Gets save status for a media item.
   */
  @Get(':mediaItemId/status')
  @ApiOperation({ summary: 'Get save status for media item (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ type: MediaSaveStatusDto })
  async getStatus(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
  ): Promise<MediaSaveStatusDto> {
    const lists = await this.savedItemsService.getListsForMedia(user.id, mediaItemId);
    return {
      isForLater: lists.includes(SAVED_ITEM_LIST.FOR_LATER),
      isConsidering: lists.includes(SAVED_ITEM_LIST.CONSIDERING),
    };
  }

  /**
   * Lists saved items in "for_later" list.
   */
  @Get('for-later')
  @ApiOperation({ summary: 'List "for later" saved items (auth: Bearer)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({ type: [SavedItemWithMediaResponseDto] })
  async listForLater(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const { total, data } = await this.savedItemsService.listWithMedia(
      user.id,
      SAVED_ITEM_LIST.FOR_LATER,
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

  /**
   * Lists saved items in "considering" list.
   */
  @Get('considering')
  @ApiOperation({ summary: 'List "considering" saved items (auth: Bearer)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({ type: [SavedItemWithMediaResponseDto] })
  async listConsidering(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const { total, data } = await this.savedItemsService.listWithMedia(
      user.id,
      SAVED_ITEM_LIST.CONSIDERING,
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
