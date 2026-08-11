import { Controller, Get, Post } from '@nestjs/common';

import { SampleClient } from '../clients/sample/sample.client';

@Controller('remote')
export class DemoController {
  constructor(private readonly client: SampleClient) {}

  @Get()
  async getHello(): Promise<{ message: string }> {
    const message: string = await this.client.getOk();
    return { message };
  }

  @Post()
  async postHello(): Promise<{ message: string }> {
    const message: string = await this.client.postOk({
      message: 'hello from nestjs',
    });
    return { message };
  }
}
