import * as crypto from 'crypto';

import { RazorpayConfig } from '../../config/razorpay.config';
import {
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  PaymentTransaction,
} from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';

import { PaymentVerificationService } from './payment-verification.service';

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

function sign(orderId: string, paymentId: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

describe('PaymentVerificationService', () => {
  const secret = 'test_key_secret';
  let findPaymentMock: jest.Mock;
  let findTransactionMock: jest.Mock;
  let findOrderMock: jest.Mock;
  let saveMock: jest.Mock;
  let service: PaymentVerificationService;

  beforeEach(() => {
    findPaymentMock = jest.fn().mockResolvedValue(payment());
    findTransactionMock = jest.fn().mockResolvedValue(transaction());
    findOrderMock = jest.fn().mockResolvedValue(order());
    saveMock = jest
      .fn()
      .mockImplementation((entity) => Promise.resolve(entity));

    const dataSourceProvider = {
      getDataSource: jest.fn().mockResolvedValue({
        getRepository: (entity: unknown) => {
          if (entity === Payment) {
            return { findOneBy: findPaymentMock };
          }
          if (entity === PaymentTransaction) {
            return { findOneBy: findTransactionMock };
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
    razorpayConfig.keySecret = secret;

    service = new PaymentVerificationService(
      dataSourceProvider,
      razorpayConfig,
    );
  });

  it('captures the payment and marks the order PAID on a valid signature (V1)', async () => {
    const signature = sign('order_razorpay_1', 'pay_1', secret);

    const result = await service.verifyPayment(
      'order-1',
      'pay_1',
      'order_razorpay_1',
      signature,
    );

    expect(result).toEqual({
      orderId: 'order-1',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const savedTransaction = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find(
        (entity) => entity instanceof PaymentTransaction,
      ) as PaymentTransaction;
    expect(savedTransaction.status).toBe('CAPTURED');
    expect(savedTransaction.providerPaymentId).toBe('pay_1');

    const savedOrder = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Order) as Order;
    expect(savedOrder.status).toBe('PAID');
  });

  it('marks the transaction FAILED and rejects on an invalid signature (V2)', async () => {
    await expect(
      service.verifyPayment(
        'order-1',
        'pay_1',
        'order_razorpay_1',
        'not-a-real-signature',
      ),
    ).rejects.toThrow();

    const savedTransaction = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find(
        (entity) => entity instanceof PaymentTransaction,
      ) as PaymentTransaction;
    expect(savedTransaction.status).toBe('FAILED');

    expect(
      saveMock.mock.calls.some(
        ([entity]: [unknown]) => entity instanceof Order,
      ),
    ).toBe(false);
  });

  it('uses the server-stored provider_order_id for the HMAC, not the client-supplied one (V3)', async () => {
    const signatureForStoredOrderId = sign('order_razorpay_1', 'pay_1', secret);

    await expect(
      service.verifyPayment(
        'order-1',
        'pay_1',
        'order_razorpay_DIFFERENT',
        signatureForStoredOrderId,
      ),
    ).resolves.toEqual({
      orderId: 'order-1',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });
  });

  it('rejects verification for a nonexistent order (V4)', async () => {
    findPaymentMock.mockResolvedValue(null);

    await expect(
      service.verifyPayment(
        'unknown-order',
        'pay_1',
        'order_razorpay_1',
        'sig',
      ),
    ).rejects.toThrow();
  });

  it('is idempotent for a repeat call with the same already-captured payment id (V5)', async () => {
    findTransactionMock.mockResolvedValue(
      transaction({
        status: PaymentStatus.CAPTURED,
        providerPaymentId: 'pay_1',
      }),
    );

    const result = await service.verifyPayment(
      'order-1',
      'pay_1',
      'order_razorpay_1',
      'irrelevant-since-already-captured',
    );

    expect(result).toEqual({
      orderId: 'order-1',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('rejects a repeat call with a different payment id for an already-captured transaction (V5)', async () => {
    findTransactionMock.mockResolvedValue(
      transaction({
        status: PaymentStatus.CAPTURED,
        providerPaymentId: 'pay_1',
      }),
    );

    await expect(
      service.verifyPayment(
        'order-1',
        'pay_DIFFERENT',
        'order_razorpay_1',
        'sig',
      ),
    ).rejects.toThrow();
  });

  it('rejects a request with missing required fields (V6)', async () => {
    await expect(
      service.verifyPayment('', 'pay_1', 'order_razorpay_1', 'sig'),
    ).rejects.toThrow();
    await expect(
      service.verifyPayment('order-1', '', 'order_razorpay_1', 'sig'),
    ).rejects.toThrow();
    await expect(
      service.verifyPayment('order-1', 'pay_1', '', 'sig'),
    ).rejects.toThrow();
    await expect(
      service.verifyPayment('order-1', 'pay_1', 'order_razorpay_1', ''),
    ).rejects.toThrow();
  });
});
