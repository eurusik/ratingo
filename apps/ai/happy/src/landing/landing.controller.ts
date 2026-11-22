import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { HAPPY_LANDING_PAGE } from './landing.page';

@Controller()
export class LandingController {
  @Get()
  show(@Res() reply: FastifyReply): void {
    reply
      .status(HAPPY_LANDING_PAGE.status)
      .headers(HAPPY_LANDING_PAGE.headers)
      .send(HAPPY_LANDING_PAGE.body);
  }
}
