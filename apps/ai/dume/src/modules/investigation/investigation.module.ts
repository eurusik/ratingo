import { Module, type OnModuleDestroy, Inject } from '@nestjs/common';
import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import { SNAPSHOT_CONFIG, type SnapshotConfig } from '../../config/config.constants';
import { InvestigationService } from './application/services/investigation.service';
import { CODE_SNAPSHOT_PORT, type CodeSnapshotPort } from './domain/ports/code-snapshot.port';
import { GithubCodeSnapshotAdapter } from './infrastructure/adapters/github.code-snapshot-adapter';
import { LocalDirectoryCodeSnapshotAdapter } from './infrastructure/adapters/local-directory.code-snapshot-adapter';

const LOCAL_ADAPTER_EXCLUDED_DIRECTORIES: readonly string[] = ['apps/ai/dume/eval'];

@Module({
  providers: [
    {
      provide: CODE_SNAPSHOT_PORT,
      inject: [SNAPSHOT_CONFIG, CLOCK_PORT],
      useFactory: (config: SnapshotConfig, clock: ClockPort): CodeSnapshotPort =>
        config.kind === 'github'
          ? new GithubCodeSnapshotAdapter(config, clock)
          : new LocalDirectoryCodeSnapshotAdapter({
              root: config.root,
              excludedDirectories: LOCAL_ADAPTER_EXCLUDED_DIRECTORIES,
            }),
    },
    InvestigationService,
  ],
  exports: [InvestigationService],
})
export class InvestigationModule implements OnModuleDestroy {
  constructor(@Inject(CODE_SNAPSHOT_PORT) private readonly snapshots: CodeSnapshotPort) {}

  async onModuleDestroy(): Promise<void> {
    await this.snapshots.dispose?.();
  }
}
