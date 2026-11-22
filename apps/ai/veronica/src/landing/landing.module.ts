import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { LandingController } from './landing.controller';
import { NeutralNotFoundFilter } from './neutral-not-found.filter';

@Module({
  controllers: [LandingController],
  providers: [{ provide: APP_FILTER, useClass: NeutralNotFoundFilter }],
})
export class LandingModule {}
