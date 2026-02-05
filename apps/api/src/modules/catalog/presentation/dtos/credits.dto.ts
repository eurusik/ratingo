import { ApiProperty } from '@nestjs/swagger';

export class CastMemberDto {
  @ApiProperty({ example: 'tmdb:123', description: 'Universal person identifier' })
  personId: string;

  @ApiProperty({ example: 'brad-pitt', description: 'URL-friendly slug', nullable: true })
  slug: string | null;

  @ApiProperty({ example: 123, deprecated: true })
  tmdbId: number;

  @ApiProperty({ example: 'Brad Pitt' })
  name: string;

  @ApiProperty({ example: 'Tyler Durden' })
  character: string;

  @ApiProperty({ example: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', nullable: true })
  profilePath: string | null;

  @ApiProperty({ example: 0 })
  order: number;
}

export class CrewMemberDto {
  @ApiProperty({ example: 'tmdb:456', description: 'Universal person identifier' })
  personId: string;

  @ApiProperty({ example: 'david-fincher', description: 'URL-friendly slug', nullable: true })
  slug: string | null;

  @ApiProperty({ example: 456, deprecated: true })
  tmdbId: number;

  @ApiProperty({ example: 'David Fincher' })
  name: string;

  @ApiProperty({ example: 'Director' })
  job: string;

  @ApiProperty({ example: 'Directing' })
  department: string;

  @ApiProperty({ example: '/y.jpg', nullable: true })
  profilePath: string | null;
}

export class CreditsDto {
  @ApiProperty({
    type: [CastMemberDto],
    example: [
      {
        personId: 'tmdb:123',
        slug: 'brad-pitt',
        tmdbId: 123,
        name: 'Brad Pitt',
        character: 'Tyler Durden',
        profilePath: '/brad.jpg',
        order: 0,
      },
    ],
  })
  cast: CastMemberDto[];

  @ApiProperty({
    type: [CrewMemberDto],
    example: [
      {
        personId: 'tmdb:456',
        slug: 'david-fincher',
        tmdbId: 456,
        name: 'David Fincher',
        job: 'Director',
        department: 'Directing',
        profilePath: '/david.jpg',
      },
    ],
  })
  crew: CrewMemberDto[];
}
