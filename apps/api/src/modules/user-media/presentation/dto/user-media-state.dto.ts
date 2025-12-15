import { ApiProperty } from '@nestjs/swagger';
import { UserMediaState } from '../../domain/entities/user-media-state.entity';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';
import { CardMetaDto } from '../../../shared/cards/presentation/dtos/card-meta.dto';

export class UserMediaStateDto implements UserMediaState {
  @ApiProperty({ example: '5f7c9b2c-1d2e-4f3a-9c4b-8a7d6e5f4c3b' })
  id!: string;

  @ApiProperty({ example: '6bd54e62-bac3-49dd-a0d4-05efd7761700' })
  userId!: string;

  @ApiProperty({ example: 'c1f2c3d4-e5f6-7890-abcd-1234567890ab' })
  mediaItemId!: string;

  @ApiProperty({ example: 'watching', enum: ['watching', 'completed', 'planned', 'dropped'] })
  state!: 'watching' | 'completed' | 'planned' | 'dropped';

  @ApiProperty({ example: 85, nullable: true, description: '0-100 rating' })
  rating!: number | null;

  @ApiProperty({
    example: { seasons: { '1': 3 } },
    nullable: true,
    description: 'Arbitrary progress payload (JSON)',
  })
  progress!: Record<string, unknown> | null;

  @ApiProperty({ example: 'Must watch this weekend', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: '2025-12-11T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-12-11T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({
    nullable: true,
    description: 'Lightweight media summary to avoid extra catalog calls',
    example: {
      id: '0a8085e4-a128-42b4-a64f-e6692c112ee6',
      type: 'show',
      title: 'Stranger Things',
      slug: 'dyvni-dyva',
      poster: {
        small: 'https://image.tmdb.org/t/p/w342/poster.jpg',
        medium: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        large: 'https://image.tmdb.org/t/p/w780/poster.jpg',
        original: 'https://image.tmdb.org/t/p/original/poster.jpg',
      },
    },
  })
  mediaSummary?: {
    id: string;
    type: 'movie' | 'show';
    title: string;
    slug: string;
    poster: ImageDto | null;
    card?: CardMetaDto;
  };
}
