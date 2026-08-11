import {
  ConfigProperty,
  ConfigurationProperties,
  Required,
} from '@snow-tzu/type-config-nestjs';

@ConfigurationProperties('aws.sns')
export class SnsConfig {
  @Required()
  @ConfigProperty('useStaticCredentials')
  useStaticCredentials: boolean;
  @ConfigProperty('accessKeyId')
  accessKeyId: string;
  @ConfigProperty('secretAccessKey')
  secretAccessKey: string;
  @ConfigProperty('sessionToken')
  sessionToken: string;
  @ConfigProperty('endpoint')
  endpoint: string;
}
