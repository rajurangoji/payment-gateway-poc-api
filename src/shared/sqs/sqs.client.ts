import { SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';

import { AwsSharedConfig } from '@shared/config/aws.shared.config';

import { SqsConfig } from './sqs.config';

@Injectable()
export class SqsClientProvider {
  private client?: SQSClient;

  constructor(
    private readonly sqsConfig: SqsConfig,
    private readonly awsConfig: AwsSharedConfig,
  ) {}

  getClient(): SQSClient {
    if (!this.client) {
      const region = this.awsConfig.region;
      const useStatic = this.sqsConfig.useStaticCredentials;
      const accessKeyId = this.sqsConfig.accessKeyId;
      const secretAccessKey = this.sqsConfig.secretAccessKey;
      const sessionToken = this.sqsConfig.sessionToken;
      const endpoint = this.sqsConfig.endpoint;

      if (useStatic && accessKeyId && secretAccessKey) {
        this.client = new SQSClient({
          region,
          endpoint,
          credentials: { accessKeyId, secretAccessKey, sessionToken },
        });
      } else {
        this.client = new SQSClient({ region, endpoint });
      }
    }
    return this.client;
  }
}
