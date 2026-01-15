/**
 * Journal Images Controller
 *
 * Proxy endpoint for serving journal images from S3.
 * Uses aggressive caching since images are immutable.
 */

import { Controller, Get, Param, Res } from '@nestjs/common';
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
  async getImage(@Param('filename') filename: string, @Res() res: FastifyReply): Promise<void> {
    const key = this.imageService.buildKeyFromFilename(filename);
    const result = await this.imageService.getImage(key);

    // Set headers and send buffer directly via Fastify
    res
      .header('Content-Type', result.contentType)
      .header('Content-Length', result.buffer.length.toString())
      .header('Cache-Control', 'public, max-age=31536000, immutable');

    if (result.etag) {
      res.header('ETag', result.etag);
    }

    res.send(result.buffer);
  }
}
