import 'reflect-metadata';
import { telemetrySdk } from './telemetry/register';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RunTrigger } from '@ratingo/ai-core';

import { parseCliArguments } from './cli/cli-arguments';
import { ConfigModule } from './config/config.module';
import { AiCoreModule } from './core/ai-core.module';
import {
  InvestigationModule,
  InvestigationService,
  InvestigationStatus,
  formatOutcome,
} from './modules/investigation/public';
import { createAppLogger } from './telemetry/app-logger';

const FAILURE_EXIT_CODE = 1;
const SIGNAL_EXIT_CODES: Readonly<Record<string, number>> = { SIGINT: 130, SIGTERM: 143 };
const DEFAULT_CLI_LOG_LEVEL = 'warn';
const USAGE = 'Usage: npm run investigate --workspace=@ratingo/ai-dume -- "<question>" [--ref=main|development]';

process.env.LOG_LEVEL ??= DEFAULT_CLI_LOG_LEVEL;
const logger = createAppLogger();

const flushTelemetry = async (): Promise<void> => {
  await logger.flush();
  await telemetrySdk?.shutdown().catch(() => undefined);
};

async function main(): Promise<number> {
  const parsed = parseCliArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${parsed.message}\n${USAGE}\n`);
    return FAILURE_EXIT_CODE;
  }
  @Module({ imports: [ConfigModule.forEnvironment(process.env), AiCoreModule, InvestigationModule] })
  class CliModule {}
  const app = await NestFactory.createApplicationContext(CliModule, { logger });
  const stop = async (signal: string): Promise<void> => {
    logger.warn({ message: 'investigation.interrupted', signal });
    await app.close();
    await flushTelemetry();
    process.exit(SIGNAL_EXIT_CODES[signal] ?? FAILURE_EXIT_CODE);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
  try {
    const outcome = await app
      .get(InvestigationService)
      .investigate({ question: parsed.question, ref: parsed.ref, trigger: RunTrigger.MANUAL });
    process.stdout.write(`${formatOutcome(outcome)}\n`);
    return outcome.status === InvestigationStatus.ANSWERED ? 0 : FAILURE_EXIT_CODE;
  } finally {
    await app.close();
  }
}

main()
  .then(async (code) => {
    await flushTelemetry();
    process.exitCode = code;
  })
  .catch(async (error: unknown) => {
    logger.error(
      error instanceof Error ? error.message : 'Investigation failed',
      error instanceof Error ? error.stack : undefined,
    );
    process.stderr.write(`${error instanceof Error ? `${error.name}: ${error.message}` : 'Investigation failed'}\n`);
    await flushTelemetry();
    process.exitCode = FAILURE_EXIT_CODE;
  });
