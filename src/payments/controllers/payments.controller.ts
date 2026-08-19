import { Controller, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { PaymentsControllerBase } from '@generated/payments/payments.controller.base';
import {
  CreateCheckoutOrderRequestDto,
  CreateCheckoutOrderResponseDto,
  OrderSummaryDto,
  ProductDtoDto,
  RazorpayWebhookPayloadDto,
  RefundResponseDto,
  VerifyPaymentRequestDto,
  VerifyPaymentResponseDto,
  WebhookAckResponseDto,
} from '@generated/payments/payments.dto';

import { CheckoutService } from '../services/checkout.service';
import { OrdersService } from '../services/orders.service';
import { PaymentVerificationService } from '../services/payment-verification.service';
import { ProductsService } from '../services/products.service';
import { RefundsService } from '../services/refunds.service';
import { WebhookService } from '../services/webhook.service';

export interface RequestWithRawBody extends FastifyRequest {
  rawBody?: Buffer;
}

@Controller()
export class PaymentsController extends PaymentsControllerBase {
  constructor(
    @Inject(REQUEST) private readonly request: RequestWithRawBody,
    private readonly productsService: ProductsService,
    private readonly checkoutService: CheckoutService,
    private readonly paymentVerificationService: PaymentVerificationService,
    private readonly webhookService: WebhookService,
    private readonly refundsService: RefundsService,
    private readonly ordersService: OrdersService,
  ) {
    super();
  }

  async listProducts(): Promise<ProductDtoDto[]> {
    return this.productsService.findActiveProducts();
  }

  async createCheckoutOrder(
    body: CreateCheckoutOrderRequestDto,
  ): Promise<CreateCheckoutOrderResponseDto> {
    return this.checkoutService.createOrder(body.userId, body.items);
  }

  async verifyRazorpayPayment(
    body: VerifyPaymentRequestDto,
  ): Promise<VerifyPaymentResponseDto> {
    return this.paymentVerificationService.verifyPayment(
      body.orderId,
      body.razorpayPaymentId,
      body.razorpayOrderId,
      body.razorpaySignature,
    );
  }

  async handleRazorpayWebhook(
    body: RazorpayWebhookPayloadDto,
    xRazorpaySignature: string,
  ): Promise<WebhookAckResponseDto> {
    const rawBody =
      this.request.rawBody?.toString('utf8') ?? JSON.stringify(body);
    return this.webhookService.handleWebhook(rawBody, xRazorpaySignature);
  }

  async refundOrder(id: string): Promise<RefundResponseDto> {
    return this.refundsService.refundOrder(id);
  }

  async listOrders(userId: string): Promise<OrderSummaryDto[]> {
    return this.ordersService.listOrdersForUser(userId);
  }
}
