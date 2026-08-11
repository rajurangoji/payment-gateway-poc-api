import { Controller, Get } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectPinoLogger(AppController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  getHello(): { message: string } {
    this.logger.info('Hello endpoint was called');
    return this.appService.getHello();
  }
}
