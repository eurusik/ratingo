import { ApiProperty } from '@nestjs/swagger';

import {
  VideoSiteEnum,
  VideoTypeEnum,
  VideoLanguageEnum,
} from '../../../../common/enums/video.enum';

export class VideoDto {
  @ApiProperty({ example: 'dQw4w9WgXcQ', description: 'YouTube video key' })
  key: string;

  @ApiProperty({ example: 'Dune: Part Two | Official Trailer 3', description: 'Video title' })
  name: string;

  @ApiProperty({ enum: VideoSiteEnum, example: VideoSiteEnum.YOUTUBE })
  site: VideoSiteEnum;

  @ApiProperty({ enum: VideoTypeEnum, example: VideoTypeEnum.TRAILER })
  type: VideoTypeEnum;

  @ApiProperty({ example: true, description: 'Is this an official video' })
  official: boolean;

  @ApiProperty({
    enum: VideoLanguageEnum,
    example: VideoLanguageEnum.EN,
    description: 'ISO 639-1 language code',
  })
  language: VideoLanguageEnum;

  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  country: string;
}
