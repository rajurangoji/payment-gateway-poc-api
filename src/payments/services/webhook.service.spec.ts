import * as crypto from 'crypto';

import { RazorpayConfig } from '../../config/razorpay.config';
import {
  Order,
  OrderStatus,
  Payment,
  PaymentEvent,
  PaymentStatus,
  PaymentTransaction,
} from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';

import { WebhookService } from './webhook.service';

const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(rawBody: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
}

function transaction(
  overrides: Partial<PaymentTransaction> = {},
): PaymentTransaction {
  const t = new PaymentTransaction();
  t.id = 'txn-1';
  t.paymentId = 'payment-1';
  t.provider = 'RAZORPAY';
  t.providerOrderId = 'order_razorpay_1';
  t.providerPaymentId = null;
  t.amount = '1598.00';
  t.currency = 'INR';
  t.status = PaymentStatus.CREATED;
  t.paymentMethod = null;
  t.failureCode = null;
  t.failureReason = null;
  t.providerResponse = null;
  t.createdAt = new Date();
  t.updatedAt = new Date();
  return Object.assign(t, overrides);
}

function payment(overrides: Partial<Payment> = {}): Payment {
  const p = new Payment();
  p.id = 'payment-1';
  p.orderId = 'order-1';
  p.provider = 'RAZORPAY';
  p.amount = '1598.00';
  p.currency = 'INR';
  p.status = PaymentStatus.CREATED;
  p.createdAt = new Date();
  p.updatedAt = new Date();
  return Object.assign(p, overrides);
}

function order(overrides: Partial<Order> = {}): Order {
  const o = new Order();
  o.id = 'order-1';
  o.orderNumber = 'ORD-1';
  o.userId = 'user-1';
  o.subtotalAmount = '1598.00';
  o.discountAmount = '0.00';
  o.taxAmount = '0.00';
  o.shippingAmount = '0.00';
  o.totalAmount = '1598.00';
  o.currency = 'INR';
  o.status = OrderStatus.PENDING_PAYMENT;
  o.createdAt = new Date();
  o.updatedAt = new Date();
  return Object.assign(o, overrides);
}

function capturedPayload(): object {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_1',
          order_id: 'order_razorpay_1',
        },
      },
    },
  };
}

function failedPayload(): object {
  return {
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_1',
          order_id: 'order_razorpay_1',
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Card declined',
        },
      },
    },
  };
}

describe('WebhookService', () => {
  let findEventMock: jest.Mock;
  let findTransactionMock: jest.Mock;
  let findPaymentMock: jest.Mock;
  let findOrderMock: jest.Mock;
  let saveMock: jest.Mock;
  let service: WebhookService;

  beforeEach(() => {
    findEventMock = jest.fn().mockResolvedValue(null);
    findTransactionMock = jest.fn().mockResolvedValue(transaction());
    findPaymentMock = jest.fn().mockResolvedValue(payment());
    findOrderMock = jest.fn().mockResolvedValue(order());
    saveMock = jest
      .fn()
      .mockImplementation((entity) => Promise.resolve(entity));

    const dataSourceProvider = {
      getDataSource: jest.fn().mockResolvedValue({
        getRepository: (entity: unknown) => {
          if (entity === PaymentEvent) {
            return { findOneBy: findEventMock };
          }
          if (entity === PaymentTransaction) {
            return { findOneBy: findTransactionMock };
          }
          if (entity === Payment) {
            return { findOneBy: findPaymentMock };
          }
          if (entity === Order) {
            return { findOneBy: findOrderMock };
          }
          return {};
        },
        transaction: jest
          .fn()
          .mockImplementation(
            async (work: (manager: unknown) => Promise<void>) => {
              await work({ save: saveMock });
            },
          ),
      }),
    } as unknown as PaymentsDataSourceProvider;

    const razorpayConfig = new RazorpayConfig();
    razorpayConfig.keyId = 'rzp_test_dummy';
    razorpayConfig.keySecret = 'dummy_secret';
    razorpayConfig.webhookSecret = WEBHOOK_SECRET;

    service = new WebhookService(dataSourceProvider, razorpayConfig);
  });

  it('processes payment.captured: transitions transaction/payment/order and records the event (W1)', async () => {
    const rawBody = JSON.stringify(capturedPayload());
    const signature = sign(rawBody);

    const result = await service.handleWebhook(rawBody, signature);

    expect(result.processingStatus).toBe('PROCESSED');

    const savedTransaction = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find(
        (entity) => entity instanceof PaymentTransaction,
      ) as PaymentTransaction;
    expect(savedTransaction.status).toBe('CAPTURED');

    const savedOrder = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Order) as Order;
    expect(savedOrder.status).toBe('PAID');

    const savedEvent = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof PaymentEvent) as PaymentEvent;
    expect(savedEvent.processingStatus).toBe('PROCESSED');
  });

  it('processes payment.failed: transitions to FAILED with failure details (W2)', async () => {
    const rawBody = JSON.stringify(failedPayload());
    const signature = sign(rawBody);

    const result = await service.handleWebhook(rawBody, signature);

    expect(result.processingStatus).toBe('PROCESSED');

    const savedTransaction = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find(
        (entity) => entity instanceof PaymentTransaction,
      ) as PaymentTransaction;
    expect(savedTransaction.status).toBe('FAILED');
    expect(savedTransaction.failureCode).toBe('BAD_REQUEST_ERROR');

    const savedOrder = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Order) as Order;
    expect(savedOrder.status).toBe('PAYMENT_FAILED');
  });

  it('rejects an invalid signature and persists nothing (W3)', async () => {
    const rawBody = JSON.stringify(capturedPayload());

    await expect(
      service.handleWebhook(rawBody, 'not-a-real-signature'),
    ).rejects.toThrow();

    expect(saveMock).not.toHaveBeenCalled();
  });

  it('acknowledges a duplicate delivery without reapplying state changes (W4)', async () => {
    const rawBody = JSON.stringify(capturedPayload());
    const signature = sign(rawBody);
    findEventMock.mockResolvedValue(
      Object.assign(new PaymentEvent(), {
        id: 'evt-1',
        eventId: 'payment.captured:pay_1',
      }),
    );

    const result = await service.handleWebhook(rawBody, signature);

    expect(result.processingStatus).toBe('DUPLICATE_IGNORED');
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('handles a malformed payload without crashing (W5)', async () => {
    const rawBody = '{not valid json';
    const signature = sign(rawBody);

    await expect(service.handleWebhook(rawBody, signature)).rejects.toThrow();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('records an unmatched event and acknowledges with 200-equivalent success (W6)', async () => {
    findTransactionMock.mockResolvedValue(null);
    const rawBody = JSON.stringify(capturedPayload());
    const signature = sign(rawBody);

    const result = await service.handleWebhook(rawBody, signature);

    expect(result.processingStatus).toBe('UNMATCHED');
    const savedEvent = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof PaymentEvent) as PaymentEvent;
    expect(savedEvent.processingStatus).toBe('UNMATCHED');
    expect(savedEvent.errorMessage).toBeTruthy();
  });

  it('stores the full raw payload on the PaymentEvent (W7)', async () => {
    const payloadObject = capturedPayload();
    const rawBody = JSON.stringify(payloadObject);
    const signature = sign(rawBody);

    await service.handleWebhook(rawBody, signature);

    const savedEvent = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof PaymentEvent) as PaymentEvent;
    expect(savedEvent.payload).toEqual(payloadObject);
  });
});
