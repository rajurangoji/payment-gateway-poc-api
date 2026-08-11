import {
  ConfigProperty,
  ConfigurationProperties,
  Required,
} from '@snow-tzu/type-config-nestjs';

@ConfigurationProperties('aws.sqs')
export class SqsConfig {
  @Required()
  useStaticCredentials: boolean;

  @ConfigProperty('accessKeyId')
  accessKeyId: string;

  @ConfigProperty('secretAccessKey')
  secretAccessKey: string;

  @ConfigProperty('sessionToken')
  sessionToken: string;

  @ConfigProperty('endpoint')
  endpoint: string;

  @ConfigProperty('defaultWaitTimeSeconds')
  defaultWaitTimeSeconds: number;

  @ConfigProperty('defaultVisibilityTimeout')
  defaultVisibilityTimeout: number;

  @ConfigProperty('defaultMaxNumberOfMessages')
  defaultMaxNumberOfMessages: number;
}
