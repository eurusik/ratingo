import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  SubmitInvestigationService,
  SubmitKind,
} from '../../application/services/submit-investigation.service';
import { InvestigationLookupService } from '../../application/services/investigation-lookup.service';
import { InternalApiGuard } from '../guards/internal-api.guard';
import { toRequestView } from '../investigation-view.mapper';
import { requestIdSchema, submissionSchema } from '../submission.schema';

@Controller('internal/investigations')
@UseGuards(InternalApiGuard)
export class InternalInvestigationController {
  constructor(
    private readonly submissions: SubmitInvestigationService,
    private readonly lookup: InvestigationLookupService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async submit(@Body() body: unknown) {
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        'requestId, question (at most 1000 characters) and an optional ref are required',
      );
    }
    const result = await this.submissions.submit(parsed.data);
    switch (result.kind) {
      case SubmitKind.ACCEPTED:
        return {
          status: 'accepted' as const,
          created: result.created,
          request: toRequestView(result.record),
        };
      case SubmitKind.REJECTED:
        throw new HttpException(
          { status: 'rejected', reason: result.reason },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case SubmitKind.CONFLICT:
        throw new ConflictException({ status: 'conflict', reason: 'request_id_reused' });
    }
  }

  @Get(':requestId')
  async find(@Param('requestId') requestId: string) {
    if (!requestIdSchema.safeParse(requestId).success) {
      throw new BadRequestException('requestId is not valid');
    }
    const record = await this.lookup.find(requestId);
    return record === null
      ? { status: 'not_found' as const }
      : { status: 'found' as const, request: toRequestView(record) };
  }
}
