import {
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  PaymentTransaction,
  Refund,
} from './entities';
import { PaymentsDataSourceProvider } from './payments-datasource.provider';
import { RazorpayApiError } from './razorpay-api.error';
import { RazorpayClientService } from './razorpay-client.service';
import { RefundsService } from './refunds.service';

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
  o.status = OrderStatus.PAID;
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
  p.status = PaymentStatus.CAPTURED;
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
  t.providerPaymentId = 'pay_1';
  t.amount = '1598.00';
  t.currency = 'INR';
  t.status = PaymentStatus.CAPTURED;
  t.paymentMethod = null;
  t.failureCode = null;
  t.failureReason = null;
  t.providerResponse = null;
  t.createdAt = new Date();
  t.updatedAt = new Date();
  return Object.assign(t, overrides);
}

describe('RefundsService', () => {
  let findOrderMock: jest.Mock;
  let findPaymentMock: jest.Mock;
  let findTransactionMock: jest.Mock;
  let findRefundMock: jest.Mock;
  let saveMock: jest.Mock;
  let createRefundMock: jest.Mock;
  let service: RefundsService;

  beforeEach(() => {
    findOrderMock = jest.fn().mockResolvedValue(order());
    findPaymentMock = jest.fn().mockResolvedValue(payment());
    findTransactionMock = jest.fn().mockResolvedValue(transaction());
    findRefundMock = jest.fn().mockResolvedValue(null);
    saveMock = jest
      .fn()
      .mockImplementation((entity) => Promise.resolve(entity));

    const dataSourceProvider = {
      getDataSource: jest.fn().mockResolvedValue({
        getRepository: (entity: unknown) => {
          if (entity === Order) {
            return { findOneBy: findOrderMock };
          }
          if (entity === Payment) {
            return { findOneBy: findPaymentMock };
          }
          if (entity === PaymentTransaction) {
            return { findOneBy: findTransactionMock };
          }
          if (entity === Refund) {
            return { findOneBy: findRefundMock };
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

    createRefundMock = jest
      .fn()
      .mockResolvedValue({ id: 'rfnd_1', status: 'processed' });
    const razorpayClient = {
      createRefund: createRefundMock,
    } as unknown as RazorpayClientService;

    service = new RefundsService(dataSourceProvider, razorpayClient);
  });

  it('refunds a paid order and moves it to REFUND_PENDING (R1)', async () => {
    const result = await service.refundOrder('order-1');

    expect(createRefundMock).toHaveBeenCalledWith('pay_1', 159800);
    expect(typeof result.refundId).toBe('string');
    expect(result).toEqual({
      orderId: 'order-1',
      refundId: result.refundId,
      providerRefundId: 'rfnd_1',
      status: 'REFUND_PENDING',
    });

    const savedRefund = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Refund) as Refund;
    expect(savedRefund.providerRefundId).toBe('rfnd_1');

    const savedOrder = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Order) as Order;
    expect(savedOrder.status).toBe('REFUND_PENDING');
  });

  it('rejects a refund for an order that was never paid (R2)', async () => {
    findOrderMock.mockResolvedValue(
      order({ status: OrderStatus.PENDING_PAYMENT }),
    );

    await expect(service.refundOrder('order-1')).rejects.toThrow();
    expect(createRefundMock).not.toHaveBeenCalled();
  });

  it('rejects a refund for an already-refunded order (R3)', async () => {
    findRefundMock.mockResolvedValue(
      Object.assign(new Refund(), { id: 'refund-existing' }),
    );

    await expect(service.refundOrder('order-1')).rejects.toThrow();
    expect(createRefundMock).not.toHaveBeenCalled();
  });

  it('rejects a refund for a nonexistent order (R4)', async () => {
    findOrderMock.mockResolvedValue(null);

    await expect(service.refundOrder('unknown-order')).rejects.toThrow();
  });

  it('leaves order status unchanged and creates no refund row on Razorpay API failure (R5)', async () => {
    createRefundMock.mockRejectedValue(
      new RazorpayApiError('boom', new Error('down')),
    );

    await expect(service.refundOrder('order-1')).rejects.toThrow();
    expect(saveMock).not.toHaveBeenCalled();
  });
});
