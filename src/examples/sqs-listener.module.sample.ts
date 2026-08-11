import { SQSClient } from '@aws-sdk/client-sqs';
import { Logger, Module } from '@nestjs/common';
import {
  AcknowledgementMode,
  SqsMessageListenerContainer,
  ValidationFailureMode,
} from '@snow-tzu/nest-sqs-listener';

import { COMMON_SQS_CLIENT } from '../constants/tokens';
import { SampleEvent } from '../events/sample.event';

import { SAMPLE_CONTAINER } from './constants';
import { ExampleQueueConfig } from './example.queue.config';
import { SampleSqsConsumer } from './sqs-listener.sample';

@Module({
  providers: [
    SampleSqsConsumer,
    {
      provide: SAMPLE_CONTAINER,
      useFactory: (
        exampleQueueConfig: ExampleQueueConfig,
        listener: SampleSqsConsumer,
        sqsClient: SQSClient,
      ): SqsMessageListenerContainer<SampleEvent> => {
        const logger = new Logger('SampleContainer');
        logger.log('Creating sample event Container');

        const container = new SqsMessageListenerContainer<SampleEvent>(
          sqsClient,
        );

        container.configure((options) => {
          options
            .queueName(exampleQueueConfig.name)
            .pollTimeout(20)
            .autoStartup(true)
            .acknowledgementMode(AcknowledgementMode.ON_SUCCESS)
            .maxConcurrentMessages(10)
            .targetClass(SampleEvent)
            .enableValidation(true)
            .validationFailureMode(ValidationFailureMode.ACKNOWLEDGE)
            .maxMessagesPerPoll(10)
            .enableBatchAcknowledgement(true)
            .batchAcknowledgementOptions(5, 1000);
        });
        container.setMessageListener(listener);

        container.setId('SampleEventListener');
        logger.log('Sample Event Container configured successfully');
        return container;
      },
      inject: [ExampleQueueConfig, SampleSqsConsumer, COMMON_SQS_CLIENT],
    },
  ],
  exports: [SAMPLE_CONTAINER],
})
export class SampleSqsListenerModule {}
