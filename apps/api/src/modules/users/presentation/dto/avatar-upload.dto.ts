import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const AVATAR_CONTENT_TYPE_VALUES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPE_VALUES)[number];

export class CreateAvatarUploadUrlDto {
  /**
   * Defines the avatar file content type.
   * Used to generate a correct file extension and set S3/R2 metadata.
   */
  @ApiProperty({ enum: AVATAR_CONTENT_TYPE_VALUES })
  @IsIn(AVATAR_CONTENT_TYPE_VALUES)
  contentType!: AvatarContentType;
}

export class AvatarUploadUrlDto {
  /**
   * Returns a presigned PUT URL for direct upload.
   */
  @ApiProperty()
  uploadUrl!: string;

  /**
   * Returns a public CDN/object URL that can be persisted as user's avatarUrl.
   */
  @ApiProperty()
  publicUrl!: string;

  /**
   * Returns storage key inside the bucket.
   */
  @ApiProperty()
  key!: string;
}
