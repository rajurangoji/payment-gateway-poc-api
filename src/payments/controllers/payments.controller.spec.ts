import { NotFoundException } from '@nestjs/common';

import { CheckoutService } from '../services/checkout.service';
import { OrdersService } from '../services/orders.service';
import { PaymentVerificationService } from '../services/payment-verification.service';
import { ProductsService } from '../services/products.service';
import { RefundsService } from '../services/refunds.service';
import { WebhookService } from '../services/webhook.service';

import { PaymentsController } from './payments.controller';

describe('PaymentsController', () => {
  let productsService: { findActiveProducts: jest.Mock };
  let checkoutService: { createOrder: jest.Mock };
  let paymentVerificationService: { verifyPayment: jest.Mock };
  let webhookService: { handleWebhook: jest.Mock };
  let refundsService: { refundOrder: jest.Mock };
  let ordersService: { listOrdersForUser: jest.Mock };
  let controller: PaymentsController;

  beforeEach(() => {
    productsService = { findActiveProducts: jest.fn() };
    checkoutService = { createOrder: jest.fn() };
    paymentVerificationService = { verifyPayment: jest.fn() };
    webhookService = { handleWebhook: jest.fn() };
    refundsService = { refundOrder: jest.fn() };
    ordersService = { listOrdersForUser: jest.fn() };

    controller = new PaymentsController(
      { rawBody: Buffer.from('{"event":"payment.captured"}', 'utf8') } as never,
      productsService as unknown as ProductsService,
      checkoutService as unknown as CheckoutService,
      paymentVerificationService as unknown as PaymentVerificationService,
      webhookService as unknown as WebhookService,
      refundsService as unknown as RefundsService,
      ordersService as unknown as OrdersService,
    );
  });

  it('listProducts delegates to ProductsService', async () => {
    productsService.findActiveProducts.mockResolvedValue([{ id: 'p1' }]);

    const result = await controller.listProducts();

    expect(result).toEqual([{ id: 'p1' }]);
    expect(productsService.findActiveProducts).toHaveBeenCalledWith();
  });

  it('createCheckoutOrder delegates to CheckoutService with userId and items', async () => {
    checkoutService.createOrder.mockResolvedValue({ orderId: 'order-1' });

    const result = await controller.createCheckoutOrder({
      userId: 'user-1',
      items: [{ productId: 'product-1', quantity: 1 }],
    });

    expect(result).toEqual({ orderId: 'order-1' });
    expect(checkoutService.createOrder).toHaveBeenCalledWith('user-1', [
      { productId: 'product-1', quantity: 1 },
    ]);
  });

  it('createCheckoutOrder propagates service errors unchanged', async () => {
    checkoutService.createOrder.mockRejectedValue(
      new NotFoundException('nope'),
    );

    await expect(
      controller.createCheckoutOrder({ userId: 'user-1', items: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('verifyRazorpayPayment delegates to PaymentVerificationService with all four fields', async () => {
    paymentVerificationService.verifyPayment.mockResolvedValue({
      status: 'PAID',
    });

    const result = await controller.verifyRazorpayPayment({
      orderId: 'order-1',
      razorpayPaymentId: 'pay_1',
      razorpayOrderId: 'order_razorpay_1',
      razorpaySignature: 'sig',
    });

    expect(result).toEqual({ status: 'PAID' });
    expect(paymentVerificationService.verifyPayment).toHaveBeenCalledWith(
      'order-1',
      'pay_1',
      'order_razorpay_1',
      'sig',
    );
  });

  it('handleRazorpayWebhook delegates to WebhookService with the raw body and signature', async () => {
    webhookService.handleWebhook.mockResolvedValue({ received: true });

    const result = await controller.handleRazorpayWebhook(
      { event: 'payment.captured' } as never,
      'sig-header',
    );

    expect(result).toEqual({ received: true });
    expect(webhookService.handleWebhook).toHaveBeenCalledWith(
      '{"event":"payment.captured"}',
      'sig-header',
    );
  });

  it('refundOrder delegates to RefundsService with the order id', async () => {
    refundsService.refundOrder.mockResolvedValue({ orderId: 'order-1' });

    const result = await controller.refundOrder('order-1');

    expect(result).toEqual({ orderId: 'order-1' });
    expect(refundsService.refundOrder).toHaveBeenCalledWith('order-1');
  });

  it('listOrders delegates to OrdersService with the user id', async () => {
    ordersService.listOrdersForUser.mockResolvedValue([{ orderId: 'order-1' }]);

    const result = await controller.listOrders('user-1');

    expect(result).toEqual([{ orderId: 'order-1' }]);
    expect(ordersService.listOrdersForUser).toHaveBeenCalledWith('user-1');
  });
});
