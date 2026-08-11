import {
  ConfigProperty,
  ConfigurationProperties,
  DefaultValue,
  Required,
  Validate,
} from '@snow-tzu/type-config-nestjs';
import { IsNumber, IsUrl } from 'class-validator';

@Validate()
export class CircuitBreakerOptions {
  @DefaultValue(10000)
  @ConfigProperty('timeout')
  timeout: number;

  @ConfigProperty('errorThresholdPercentage')
  @DefaultValue(50)
  errorThresholdPercentage: number;

  @DefaultValue(30000)
  @ConfigProperty('resetTimeout')
  resetTimeout: number;

  @ConfigProperty('rollingCountTimeout')
  @DefaultValue(10000)
  @IsNumber()
  @Required()
  rollingCountTimeout: number;

  @Required()
  @ConfigProperty('rollingCountBuckets')
  @DefaultValue(10)
  @IsNumber()
  @Required()
  rollingCountBuckets: number;

  @Required()
  @ConfigProperty('volumeThreshold')
  @IsNumber()
  @DefaultValue(5)
  volumeThreshold: number;
}

@ConfigurationProperties('clients.sample')
@Validate()
export class SampleClientConfig {
  @IsUrl()
  @Required()
  @ConfigProperty('baseUrl')
  baseURL: string;

  @Required()
  @ConfigProperty('circuitBreaker')
  circuitBreaker: CircuitBreakerOptions;
}
