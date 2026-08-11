import { SNSClient } from '@aws-sdk/client-sns';
import { Module } from '@nestjs/common';
import {
  SnsMessagePublisher,
  TimestampEnricher,
} from '@snow-tzu/aws-message-publisher';

import { TenantEnricher } from '@shared';
import {
  COMMON_SNS_CLIENT,
  CUSTOM_MESSAGE_PUBLISHER,
} from 'src/constants/tokens';

import { AwsModule } from '../aws.module';
import { SampleEvent } from '../events/sample.event';

import { QueryController } from './query/query.controller';
import { QueryService } from './query/query.service';

@Module({
  imports: [AwsModule],
  controllers: [QueryController],
  providers: [
    QueryService,
    {
      provide: CUSTOM_MESSAGE_PUBLISHER,
      useFactory: (snsClient: SNSClient): SnsMessagePublisher<SampleEvent> => {
        const snsPublisher = new SnsMessagePublisher<SampleEvent>(snsClient);
        snsPublisher.configure((config) =>
          config
            .topicArn('test-custom-events')
            .addEnricher(new TimestampEnricher())
            .addEnricher(new TenantEnricher()),
        );
        return snsPublisher;
      },
      inject: [COMMON_SNS_CLIENT],
    },
  ],
})
export class CustomsModule {
  // This module is responsible for handling customs-related commands.
  // It includes controllers and command handlers for creating packages.
}
