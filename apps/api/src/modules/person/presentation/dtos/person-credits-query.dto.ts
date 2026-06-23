import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  PERSON_CREDITS_DEFAULT_LIMIT,
  PERSON_CREDITS_MAX_LIMIT,
  PersonCreditType,
  type PersonCreditTypeValue,
} from '../../domain/constants/person.constants';

const CREDIT_TYPE_VALUES = Object.values(PersonCreditType);

export class PersonCreditsQueryDto {
  @ApiPropertyOptional({
    default: PERSON_CREDITS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PERSON_CREDITS_MAX_LIMIT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PERSON_CREDITS_MAX_LIMIT)
  @Type(() => Number)
  limit: number = PERSON_CREDITS_DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset: number = 0;

  @ApiPropertyOptional({ enum: PersonCreditType, description: 'Filter by cast or crew' })
  @IsOptional()
  @IsIn(CREDIT_TYPE_VALUES)
  creditType?: PersonCreditTypeValue;
}
