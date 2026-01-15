import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { POST_TYPE_VALUES, PostType } from '../../domain/constants/post-types';

/**
 * DTO for updating a journal post.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdatePostDto {
  @ApiPropertyOptional({
    description: 'Post title',
    example: 'Що нового в Ratingo',
    minLength: 3,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Post body in Markdown format',
    example: '## Нові функції\n\nМи додали...',
    minLength: 10,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  body?: string;

  @ApiPropertyOptional({
    description: 'Post type',
    enum: POST_TYPE_VALUES,
    example: 'update',
  })
  @IsOptional()
  @IsIn(POST_TYPE_VALUES)
  type?: PostType;

  @ApiPropertyOptional({
    description: 'Custom URL slug',
    example: 'shcho-novoho-v-ratingo',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Featured image URL or path for Open Graph previews',
    example: '/api/journal/images/uuid.jpg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/|\/)\S+$/, {
    message: 'featuredImageUrl must be a URL or path starting with /',
  })
  featuredImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Context identifier for linking post to product features',
    example: 'trending',
  })
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiPropertyOptional({
    description: 'Custom meta title for SEO',
    example: 'Що нового в Ratingo | Журнал',
    maxLength: 70,
  })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'Custom meta description for SEO',
    example: 'Дізнайтеся про останні оновлення Ratingo...',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Save as draft without publishing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @ApiPropertyOptional({
    description: 'Publication date (for scheduling). ISO 8601 format.',
    example: '2026-01-15T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
