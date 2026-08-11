import { SNSClient } from '@aws-sdk/client-sns';
import { Injectable } from '@nestjs/common';

import { AwsSharedConfig } from '@shared/config/aws.shared.config';

import { SnsConfig } from './sns.config';

@Injectable()
export class SnsClientProvider {
  private client?: SNSClient;

  constructor(
    private readonly snsConfig: SnsConfig,
    private readonly awsConfig: AwsSharedConfig,
  ) {}

  getClient(): SNSClient {
    if (!this.client) {
      const region = this.awsConfig.region;
      const useStatic = this.snsConfig.useStaticCredentials;
      const accessKeyId = this.snsConfig.accessKeyId;
      const secretAccessKey = this.snsConfig.secretAccessKey;
      const sessionToken = this.snsConfig.sessionToken;
      const endpoint = this.snsConfig.endpoint;

      // Prefer explicit credentials when configured; otherwise, default chain
      if (useStatic && accessKeyId && secretAccessKey) {
        this.client = new SNSClient({
          region,
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
            sessionToken,
          },
        });
      } else {
        this.client = new SNSClient({ region, endpoint });
      }
    }
    return this.client;
  }
}
