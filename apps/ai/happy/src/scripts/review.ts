import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { RunTrigger } from '@ratingo/ai-core';

import { ConfigModule } from '../config/config.module';
import { AiCoreModule } from '../core/ai-core.module';
import { ReviewModule, ReviewService, parseRepository } from '../modules/review/public';

const USAGE = 'Usage: npm run review --workspace=@ratingo/ai-happy -- <owner/repo> <prNumber>';
const FAILURE_EXIT_CODE = 1;

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  return process.exit(FAILURE_EXIT_CODE);
};

async function main(): Promise<void> {
  const [repositoryArg, numberArg] = process.argv.slice(2);
  const repository = parseRepository(repositoryArg ?? '');
  const pullNumber = Number(numberArg);
  if (repository === null || !Number.isInteger(pullNumber) || pullNumber <= 0) {
    fail(USAGE);
    return;
  }

  @Module({
    imports: [ConfigModule.forCli(process.env, repositoryArg ?? ''), AiCoreModule, ReviewModule],
  })
  class CliModule {}

  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['warn', 'error'] });
  try {
    const outcome = await app
      .get(ReviewService)
      .review({ ...repository, number: pullNumber }, RunTrigger.MANUAL);
    process.stdout.write(
      `${outcome.markdown}\n\n[status=${outcome.status} cost=$${outcome.costUsd.toFixed(4)}]\n`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? `${error.name}: ${error.message}` : 'Review failed');
});
