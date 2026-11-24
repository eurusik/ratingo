import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { VERONICA_LANDING_PAGE } from './landing.page';

@Controller()
export class LandingController {
  @Get()
  show(@Res() reply: FastifyReply): void {
    reply
      .status(VERONICA_LANDING_PAGE.status)
      .headers(VERONICA_LANDING_PAGE.headers)
      .send(VERONICA_LANDING_PAGE.body);
  }
}
