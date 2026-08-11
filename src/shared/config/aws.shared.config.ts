import {
  ConfigurationProperties,
  DefaultValue,
  Required,
} from '@snow-tzu/type-config-nestjs';

@ConfigurationProperties('aws')
export class AwsSharedConfig {
  @Required()
  @DefaultValue('us-east-1')
  region: string;
}
