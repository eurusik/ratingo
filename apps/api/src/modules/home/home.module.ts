import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { HomeController } from './presentation/home.controller';
import { HomeService } from './application/home.service';

@Module({
  imports: [CatalogModule], // Import CatalogModule to access repositories
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
