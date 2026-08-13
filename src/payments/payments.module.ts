import { Module } from '@nestjs/common';

import { AwsModule } from '../aws.module';

import { CheckoutService } from './checkout.service';
import { OrderEventsPublisher } from './order-events.publisher';
import { PaymentVerificationService } from './payment-verification.service';
import { PaymentsDataSourceProvider } from './payments-datasource.provider';
import { PaymentsController } from './payments.controller';
import { ProductsService } from './products.service';
import { RazorpayClientService } from './razorpay-client.service';
import { RefundsService } from './refunds.service';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AwsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsDataSourceProvider,
    RazorpayClientService,
    OrderEventsPublisher,
    ProductsService,
    CheckoutService,
    PaymentVerificationService,
    WebhookService,
    RefundsService,
  ],
})
export class PaymentsModule {}
