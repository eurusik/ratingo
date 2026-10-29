import { Module } from '@nestjs/common';

import { buildAppCoreImports } from './app-core.imports';
import { getAppRole } from './common/runtime/app-role';
import { CatalogPolicyModule } from './modules/catalog-policy/catalog-policy.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { StatsModule } from './modules/stats/stats.module';
import { UserActionsModule } from './modules/user-actions/user-actions.module';
import { UserMediaModule } from './modules/user-media/user-media.module';

@Module({
  imports: [
    ...buildAppCoreImports(getAppRole()),
    IngestionModule,
    CatalogPolicyModule,
    StatsModule,
    UserMediaModule,
    UserActionsModule,
  ],
})
export class WorkerAppModule {}
