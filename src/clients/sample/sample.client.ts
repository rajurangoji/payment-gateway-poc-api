import { Inject, Injectable, Logger } from '@nestjs/common';

import { ICircuitHttpClient } from '@shared';

import { SAMPLE_HTTP_CLIENT } from '../clients.token';

@Injectable()
export class SampleClient {
  private readonly logger = new Logger('SampleClient');

  constructor(
    @Inject(SAMPLE_HTTP_CLIENT)
    private readonly httpClient: ICircuitHttpClient,
  ) {}

  async getOk(): Promise<string> {
    this.logger.log(`Fetching /ok endpoint`);
    const response = await this.httpClient.get<string>('/ok');
    this.logger.log(`Received response: ${response}`);
    return response;
  }

  async postOk(data: { message: string }): Promise<string> {
    this.logger.log(
      `Posting to /ok endpoint with data: ${JSON.stringify(data)}`,
    );
    const response = await this.httpClient.post<string, { message: string }>(
      '/ok',
      data,
    );
    this.logger.log(`Received response: ${response}`);
    return response;
  }
}
