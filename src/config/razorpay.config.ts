import {
  ConfigProperty,
  ConfigurationProperties,
  Required,
} from '@snow-tzu/type-config-nestjs';

@ConfigurationProperties('razorpay')
export class RazorpayConfig {
  @Required()
  keyId: string;

  @Required()
  keySecret: string;

  @ConfigProperty('webhookSecret')
  webhookSecret?: string;
}
