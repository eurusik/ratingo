import { ApiProperty } from '@nestjs/swagger';

/**
 * Image DTO with multiple sizes.
 * Used across modules for poster, backdrop, logo images.
 */
export class ImageDto {
  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w342/abc.jpg',
    description: 'Small image for cards (w342)',
  })
  small: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w500/abc.jpg',
    description: 'Medium image for details (w500)',
  })
  medium: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w780/abc.jpg',
    description: 'Large image for banners (w780)',
  })
  large: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/original/abc.jpg',
    description: 'Original quality image',
  })
  original: string;
}
