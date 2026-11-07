import { ApiProperty } from '@nestjs/swagger';

export class UserPrivacyDto {
  @ApiProperty()
  isProfilePublic: boolean;

  @ApiProperty()
  showWatchHistory: boolean;

  @ApiProperty()
  showRatings: boolean;

  @ApiProperty()
  allowFollowers: boolean;
}

export class PublicUserProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({ type: String, nullable: true })
  location: string | null;

  @ApiProperty({ type: String, nullable: true })
  website: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  privacy: UserPrivacyDto;
}
