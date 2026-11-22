import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { RunTrigger } from '@ratingo/ai-core';

import { ReviewService } from '../../application/services/review.service';
import { RepositoryNotAllowedError } from '../../domain/errors/review.errors';
import { CodeHostError } from '../../domain/ports/code-host.port';
import { ServiceTokenGuard } from '../guards/service-token.guard';
import { parseRepository } from '../parse-repository';

const requestSchema = z.object({
  repository: z.string().min(3).max(200),
  pullNumber: z.number().int().positive(),
});

@Controller('internal/review')
@UseGuards(ServiceTokenGuard)
export class InternalReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Post()
  @HttpCode(200)
  async review(
    @Body() body: unknown,
  ): Promise<{ markdown: string; status: string; costUsd: number }> {
    const parsed = requestSchema.safeParse(body);
    const repository = parsed.success ? parseRepository(parsed.data.repository) : null;
    if (!parsed.success || repository === null) {
      throw new BadRequestException(
        'repository must be owner/name and pullNumber a positive integer',
      );
    }
    try {
      const outcome = await this.reviews.review(
        { ...repository, number: parsed.data.pullNumber },
        RunTrigger.CHAT,
      );
      return { markdown: outcome.markdown, status: outcome.status, costUsd: outcome.costUsd };
    } catch (error) {
      if (error instanceof RepositoryNotAllowedError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof CodeHostError) {
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }
}
