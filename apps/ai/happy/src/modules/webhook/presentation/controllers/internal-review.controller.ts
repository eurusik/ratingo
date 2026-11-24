import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';

import { z } from 'zod';

import { CodeHostError, RequestedMode } from '../../../review/public';
import {
  InternalReviewService,
  RepositoryNotConfiguredError,
} from '../../application/services/internal-review.service';
import { MAX_PULL_NUMBER_DIGITS } from '../../domain/constants/webhook.constants';
import { InternalApiGuard } from '../guards/internal-api.guard';
import { toLatestResponse } from '../internal-review.mapper';

const PULL_NUMBER_PATTERN = new RegExp(`^[1-9]\\d{0,${MAX_PULL_NUMBER_DIGITS - 1}}$`);

const requestBodySchema = z
  .object({ mode: z.enum([RequestedMode.AUTO, RequestedMode.FULL]).default(RequestedMode.AUTO) })
  .strict();

const parseMode = (body: unknown): RequestedMode => {
  const parsed = requestBodySchema.safeParse(body ?? {});
  if (!parsed.success) throw new BadRequestException('mode must be "auto" or "full"');
  return parsed.data.mode;
};

const parsePullNumber = (raw: string): number => {
  if (!PULL_NUMBER_PATTERN.test(raw)) {
    throw new BadRequestException('pull request number must be a positive integer');
  }
  return Number(raw);
};

const translate = (error: unknown): never => {
  if (error instanceof RepositoryNotConfiguredError) {
    throw new ServiceUnavailableException('Repository is not configured');
  }
  if (error instanceof CodeHostError) {
    throw new BadGatewayException('Code host request failed');
  }
  throw error;
};

@Controller('internal/pull-requests')
@UseGuards(InternalApiGuard)
export class InternalReviewController {
  constructor(private readonly reviews: InternalReviewService) {}

  @Get()
  async openPullRequests() {
    try {
      return { status: 'ok' as const, pullRequests: await this.reviews.listOpen() };
    } catch (error) {
      return translate(error);
    }
  }

  @Post(':number/review')
  @HttpCode(200)
  async request(@Param('number') number: string, @Body() body: unknown) {
    const pullNumber = parsePullNumber(number);
    const mode = parseMode(body);
    try {
      return await this.reviews.request(pullNumber, mode);
    } catch (error) {
      return translate(error);
    }
  }

  @Get(':number/review')
  async latest(@Param('number') number: string) {
    const pullNumber = parsePullNumber(number);
    try {
      return toLatestResponse(await this.reviews.latest(pullNumber));
    } catch (error) {
      return translate(error);
    }
  }
}
