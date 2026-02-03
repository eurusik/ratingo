import { Global, Module } from '@nestjs/common';

import { CLOCK_PORT, SystemClock } from './clock.port';

/**
 * Clock Module - Provides time abstraction.
 *
 * Global module so it's available everywhere without explicit imports.
 */
@Global()
@Module({
  providers: [
    {
      provide: CLOCK_PORT,
      useClass: SystemClock,
    },
  ],
  exports: [CLOCK_PORT],
})
export class ClockModule {}
