import {
  ConfigurationProperties,
  Required,
} from '@snow-tzu/type-config-nestjs';

@ConfigurationProperties('queues.example')
export class ExampleQueueConfig {
  @Required()
  name: string;
}
