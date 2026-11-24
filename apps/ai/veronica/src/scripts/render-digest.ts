import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { RunTrigger } from '@ratingo/ai-core';

import { ConfigModule } from '../config/config.module';
import { AiCoreModule } from '../core/ai-core.module';
import { DigestComposeService, DigestModule } from '../modules/digest/public';
import { RunsModule } from '../modules/runs/public';

@Module({
  imports: [
    ConfigModule.forPreview(process.env),
    RunsModule.inMemory(),
    AiCoreModule,
    DigestModule,
  ],
})
class PreviewModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(PreviewModule, { logger: ['error'] });
  const { message } = await app.get(DigestComposeService).compose(RunTrigger.MANUAL);
  process.stdout.write(`${message.html}\n\n[silent=${message.silent}]\n`);
  await app.close();
}

void main();
