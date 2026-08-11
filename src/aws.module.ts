import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { Global, Module } from '@nestjs/common';

import { SnsClientProvider, SqsClientProvider } from '@shared';

import { COMMON_SNS_CLIENT, COMMON_SQS_CLIENT } from './constants/tokens';

@Global()
@Module({
  providers: [
    SqsClientProvider,
    {
      provide: COMMON_SQS_CLIENT,
      useFactory: (sqsClientProvider: SqsClientProvider): SQSClient =>
        sqsClientProvider.getClient(),
      inject: [SqsClientProvider],
    },
    SnsClientProvider,
    {
      provide: COMMON_SNS_CLIENT,
      useFactory: (snsClientProvider: SnsClientProvider): SNSClient =>
        snsClientProvider.getClient(),
      inject: [SnsClientProvider],
    },
  ],
  exports: [COMMON_SQS_CLIENT, COMMON_SNS_CLIENT],
})
export class AwsModule {}
