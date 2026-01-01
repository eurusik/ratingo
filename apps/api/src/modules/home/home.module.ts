import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';

import { HomeService } from './application/home.service';
import { HomeController } from './presentation/home.controller';

/**
 * Home module.
 */
@Module({
  imports: [CatalogModule], // Import CatalogModule to access repositories
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
