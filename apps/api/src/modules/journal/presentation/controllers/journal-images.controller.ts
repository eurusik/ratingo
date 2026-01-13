/**
 * Journal Images Controller
 *
 * Proxy endpoint for serving journal images from S3.
 * Uses aggressive caching since images are immutable.
 */

import { Controller, Get, Header, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { FastifyReply } from 'fastify';

import { JournalImageService } from '../../application/journal-image.service';

/**
 * Journal images proxy controller.
 * Serves images from S3 with caching headers.
 */
@ApiTags('Public: Journal')
@Controller('journal/images')
export class JournalImagesController {
  constructor(private readonly imageService: JournalImageService) {}

  /**
   * Serves a journal image by filename.
   * Images are served with aggressive caching (1 year, immutable).
   *
   * @param filename - Image filename (e.g., "uuid.jpg")
   * @param res - Fastify response for setting headers
   * @returns Streamable image file
   */
  @Get(':filename')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @ApiOperation({
    summary: 'Get journal image',
    description: 'Serves a journal image from storage. Images are cached for 1 year.',
  })
  @ApiParam({
    name: 'filename',
    description: 'Image filename',
    example: '550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  @ApiOkResponse({
    description: 'Image file',
    content: {
      'image/jpeg': {},
      'image/png': {},
      'image/webp': {},
      'image/gif': {},
    },
  })
  async getImage(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    const key = this.imageService.buildKeyFromFilename(filename);
    const result = await this.imageService.getImage(key);

    // Set content type header
    res.header('Content-Type', result.contentType);

    // Set content length if available
    if (result.contentLength) {
      res.header('Content-Length', result.contentLength.toString());
    }

    // Set ETag for conditional requests
    if (result.etag) {
      res.header('ETag', result.etag);
    }

    return new StreamableFile(result.stream);
  }
}
