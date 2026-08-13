import {
  GetQueueUrlCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { COMMON_SQS_CLIENT } from '../constants/tokens';

import { OrderCreatedEvent } from './order-created.event';
import { OrderEventsQueueConfig } from './order-events-queue.config';

@Injectable()
export class OrderEventsPublisher {
  private queueUrl?: string;

  constructor(
    @Inject(COMMON_SQS_CLIENT) private readonly sqsClient: SQSClient,
    private readonly queueConfig: OrderEventsQueueConfig,
    @InjectPinoLogger(OrderEventsPublisher.name)
    private readonly logger: PinoLogger,
  ) {}

  async publishOrderCreated(payload: OrderCreatedEvent): Promise<void> {
    try {
      const queueUrl = await this.resolveQueueUrl();
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish ORDER_CREATED event for order ${payload.orderId}`,
        error,
      );
    }
  }

  private async resolveQueueUrl(): Promise<string> {
    if (!this.queueUrl) {
      const result = await this.sqsClient.send(
        new GetQueueUrlCommand({ QueueName: this.queueConfig.name }),
      );
      if (!result.QueueUrl) {
        throw new Error(
          `Could not resolve SQS queue URL for queue name: ${this.queueConfig.name}`,
        );
      }
      this.queueUrl = result.QueueUrl;
    }
    return this.queueUrl;
  }
}
