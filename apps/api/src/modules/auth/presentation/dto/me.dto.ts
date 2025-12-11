import { ApiProperty } from '@nestjs/swagger';

class PrivacyDto {
  @ApiProperty({ example: true })
  isProfilePublic!: boolean;

  @ApiProperty({ example: false })
  showWatchHistory!: boolean;

  @ApiProperty({ example: true })
  showRatings!: boolean;

  @ApiProperty({ example: true })
  allowFollowers!: boolean;
}

class ProfileDto {
  @ApiProperty({ example: 'Люблю жахи та sci-fi', nullable: true })
  bio!: string | null;

  @ApiProperty({ example: 'Kyiv', nullable: true })
  location!: string | null;

  @ApiProperty({ example: 'https://instagram.com/me', nullable: true })
  website!: string | null;

  @ApiProperty({ example: 'uk', nullable: true })
  preferredLanguage!: string | null;

  @ApiProperty({ example: 'UA', nullable: true })
  preferredRegion!: string | null;

  @ApiProperty({ type: PrivacyDto })
  privacy!: PrivacyDto;
}

class StatsDto {
  @ApiProperty({ example: 24 })
  moviesRated!: number;

  @ApiProperty({ example: 10 })
  showsRated!: number;

  @ApiProperty({ example: 42 })
  watchlistCount!: number;
}

export class MeDto {
  @ApiProperty({ example: '6bd54e62-bac3-49dd-a0d4-05efd7761700' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'ratingo_fan' })
  username!: string;

  @ApiProperty({
    example: 'https://cdn.ratingo/avatar.png',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ example: 'user', enum: ['user', 'admin'] })
  role!: 'user' | 'admin';

  @ApiProperty({ type: ProfileDto })
  profile!: ProfileDto;

  @ApiProperty({ type: StatsDto })
  stats!: StatsDto;
}
