import {
  ConfigurationProperties,
  Required,
} from '@snow-tzu/type-config-nestjs';

@ConfigurationProperties('queues.orderEvents')
export class OrderEventsQueueConfig {
  @Required()
  name: string;
}
