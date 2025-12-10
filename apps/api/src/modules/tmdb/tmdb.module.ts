import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import tmdbConfig from '../../config/tmdb.config';
import { TmdbAdapter } from './tmdb.adapter';

@Module({
  imports: [ConfigModule.forFeature(tmdbConfig)],
  providers: [TmdbAdapter],
  exports: [TmdbAdapter],
})
export class TmdbModule {}
