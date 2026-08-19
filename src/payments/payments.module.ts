import { Module } from '@nestjs/common';

import { RazorpayClientService } from './clients/razorpay-client.service';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsDataSourceProvider } from './providers/payments-datasource.provider';
import { CheckoutService } from './services/checkout.service';
import { OrdersService } from './services/orders.service';
import { PaymentVerificationService } from './services/payment-verification.service';
import { ProductsService } from './services/products.service';
import { RefundsService } from './services/refunds.service';
import { WebhookService } from './services/webhook.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsDataSourceProvider,
    RazorpayClientService,
    ProductsService,
    CheckoutService,
    PaymentVerificationService,
    WebhookService,
    RefundsService,
    OrdersService,
  ],
})
export class PaymentsModule {}
