import { ApiProperty } from '@nestjs/swagger';

export class RecentRaterDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique user identifier',
  })
  userId: string;

  @ApiProperty({ example: 'john_doe', description: 'Public username of the rater' })
  username: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
    description: 'URL of the user avatar image',
  })
  avatarUrl: string | null;
}
