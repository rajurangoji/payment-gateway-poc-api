import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { RazorpayConfig } from '../config/razorpay.config';

import { CheckoutService } from './checkout.service';
import {
  CartProduct,
  CartProductStatus,
  Order,
  OrderItem,
  Payment,
  PaymentTransaction,
  User,
} from './entities';
import { OrderEventsPublisher } from './order-events.publisher';
import { PaymentsDataSourceProvider } from './payments-datasource.provider';
import { RazorpayApiError } from './razorpay-api.error';
import { RazorpayClientService } from './razorpay-client.service';

function cartProduct(overrides: Partial<CartProduct> = {}): CartProduct {
  const product = new CartProduct();
  product.id = 'product-1';
  product.userId = 'user-1';
  product.name = 'Wireless Mouse';
  product.sku = 'SKU-MOUSE-001';
  product.price = '799.00';
  product.currency = 'INR';
  product.stockQuantity = 120;
  product.status = CartProductStatus.ACTIVE;
  product.createdAt = new Date();
  product.updatedAt = new Date();
  return Object.assign(product, overrides);
}

function user(overrides: Partial<User> = {}): User {
  const u = new User();
  u.id = 'user-1';
  u.email = 'buyer@example.com';
  u.name = 'Demo Buyer';
  u.phone = null;
  u.createdAt = new Date();
  u.updatedAt = new Date();
  return Object.assign(u, overrides);
}

describe('CheckoutService', () => {
  let findProductsMock: jest.Mock;
  let findUserMock: jest.Mock;
  let transactionMock: jest.Mock;
  let saveMock: jest.Mock;
  let createOrderMock: jest.Mock;
  let publishMock: jest.Mock;
  let service: CheckoutService;

  beforeEach(() => {
    findProductsMock = jest.fn().mockResolvedValue([cartProduct()]);
    findUserMock = jest.fn().mockResolvedValue(user());
    saveMock = jest
      .fn()
      .mockImplementation((entity) => Promise.resolve(entity));
    transactionMock = jest
      .fn()
      .mockImplementation(async (work: (manager: unknown) => Promise<void>) => {
        await work({ save: saveMock });
      });

    const dataSourceProvider = {
      getDataSource: jest.fn().mockResolvedValue({
        getRepository: (entity: unknown) => {
          if (entity === User) {
            return { findOneBy: findUserMock };
          }
          return { find: findProductsMock };
        },
        transaction: transactionMock,
      }),
    } as unknown as PaymentsDataSourceProvider;

    createOrderMock = jest.fn().mockResolvedValue({
      id: 'order_razorpay_1',
      amount: 159800,
      currency: 'INR',
      status: 'created',
    });
    const razorpayClient = {
      createOrder: createOrderMock,
    } as unknown as RazorpayClientService;

    publishMock = jest.fn().mockResolvedValue(undefined);
    const orderEventsPublisher = {
      publishOrderCreated: publishMock,
    } as unknown as OrderEventsPublisher;

    const razorpayConfig = new RazorpayConfig();
    razorpayConfig.keyId = 'rzp_test_dummy';
    razorpayConfig.keySecret = 'dummy_secret';

    service = new CheckoutService(
      dataSourceProvider,
      razorpayClient,
      orderEventsPublisher,
      razorpayConfig,
    );
  });

  it('computes the total server-side, persists the order atomically, and returns the checkout response (C1)', async () => {
    const result = await service.createOrder('user-1', [
      { productId: 'product-1', quantity: 2 },
    ]);

    expect(typeof result.orderId).toBe('string');
    expect(result).toEqual({
      orderId: result.orderId,
      razorpayOrderId: 'order_razorpay_1',
      amount: 159800,
      currency: 'INR',
      keyId: 'rzp_test_dummy',
    });

    expect(createOrderMock).toHaveBeenCalledWith(
      159800,
      'INR',
      expect.any(String),
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    const savedOrder = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Order) as Order;
    expect(savedOrder).toBeDefined();
    expect(savedOrder.status).toBe('PENDING_PAYMENT');
    expect(savedOrder.totalAmount).toBe('1598.00');

    const savedItems = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => Array.isArray(entity)) as OrderItem[];
    expect(savedItems).toHaveLength(1);
    expect(savedItems[0].quantity).toBe(2);
    expect(savedItems[0].orderId).toBe(savedOrder.id);

    const savedPayment = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find((entity) => entity instanceof Payment) as Payment;
    expect(savedPayment.status).toBe('CREATED');
    expect(savedPayment.orderId).toBe(savedOrder.id);

    const savedTransaction = saveMock.mock.calls
      .map(([entity]: [unknown]) => entity)
      .find(
        (entity) => entity instanceof PaymentTransaction,
      ) as PaymentTransaction;
    expect(savedTransaction.providerOrderId).toBe('order_razorpay_1');
    expect(savedTransaction.paymentId).toBe(savedPayment.id);

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ORDER_CREATED',
        orderId: savedOrder.id,
        razorpayOrderId: 'order_razorpay_1',
        totalAmount: 1598,
        currency: 'INR',
        status: 'PENDING_PAYMENT',
      }),
    );
  });

  it('never touches the database when the Razorpay Orders API call fails (C8)', async () => {
    createOrderMock.mockRejectedValue(
      new RazorpayApiError('boom', new Error('down')),
    );

    await expect(
      service.createOrder('user-1', [{ productId: 'product-1', quantity: 2 }]),
    ).rejects.toThrow();

    expect(transactionMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('publishes a distinct ORDER_CREATED event per call, for two separate orders (E3)', async () => {
    await service.createOrder('user-1', [
      { productId: 'product-1', quantity: 1 },
    ]);
    await service.createOrder('user-1', [
      { productId: 'product-1', quantity: 1 },
    ]);

    expect(publishMock).toHaveBeenCalledTimes(2);
    const [firstCallPayload] = publishMock.mock.calls[0] as [
      { orderId: string },
    ];
    const [secondCallPayload] = publishMock.mock.calls[1] as [
      { orderId: string },
    ];
    expect(firstCallPayload.orderId).not.toBe(secondCallPayload.orderId);
  });

  it('still returns success even if publishing ORDER_CREATED rejects (E2)', async () => {
    publishMock.mockRejectedValue(new Error('sqs down'));

    await expect(
      service.createOrder('user-1', [{ productId: 'product-1', quantity: 1 }]),
    ).resolves.toBeDefined();
  });

  it('ignores any client-supplied amount field and computes it server-side (C2)', async () => {
    const maliciousItems = [
      { productId: 'product-1', quantity: 1, amount: 1 },
    ] as unknown as { productId: string; quantity: number }[];

    const result = await service.createOrder('user-1', maliciousItems as never);

    expect(result.amount).toBe(79900);
  });

  it('rejects an unknown product id with no rows created (C3)', async () => {
    findProductsMock.mockResolvedValue([]);

    await expect(
      service.createOrder('user-1', [
        { productId: 'unknown-product', quantity: 1 },
      ]),
    ).rejects.toThrow(NotFoundException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects insufficient stock with no rows created (C4)', async () => {
    findProductsMock.mockResolvedValue([cartProduct({ stockQuantity: 1 })]);

    await expect(
      service.createOrder('user-1', [{ productId: 'product-1', quantity: 5 }]),
    ).rejects.toThrow(ConflictException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects an empty items array (C5)', async () => {
    await expect(service.createOrder('user-1', [])).rejects.toThrow(
      BadRequestException,
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects a non-positive or non-integer quantity (C6)', async () => {
    await expect(
      service.createOrder('user-1', [{ productId: 'product-1', quantity: 0 }]),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createOrder('user-1', [
        { productId: 'product-1', quantity: 1.5 },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown user with no order created (C7)', async () => {
    findUserMock.mockResolvedValue(null);

    await expect(
      service.createOrder('unknown-user', [
        { productId: 'product-1', quantity: 1 },
      ]),
    ).rejects.toThrow(NotFoundException);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
