import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { POST_TYPE_VALUES, PostType } from '../../domain/constants/post-types';

/**
 * DTO for creating a journal post.
 */
export class CreatePostDto {
  @ApiProperty({
    description: 'Post title',
    example: 'Що нового в Ratingo',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Post body in Markdown format',
    example: '## Нові функції\n\nМи додали...',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  body: string;

  @ApiProperty({
    description: 'Post type',
    enum: POST_TYPE_VALUES,
    example: 'update',
  })
  @IsIn(POST_TYPE_VALUES)
  type: PostType;

  @ApiPropertyOptional({
    description: 'Custom URL slug (auto-generated from title if not provided)',
    example: 'shcho-novoho-v-ratingo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Featured image URL for Open Graph previews',
    example: 'https://cdn.ratingo.com/journal/featured.jpg',
  })
  @IsOptional()
  @IsUrl()
  featuredImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Context identifier for linking post to product features',
    example: 'trending',
  })
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiPropertyOptional({
    description: 'Custom meta title for SEO (defaults to post title)',
    example: 'Що нового в Ratingo | Журнал',
    maxLength: 70,
  })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'Custom meta description for SEO (defaults to excerpt)',
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
    default: true,
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
