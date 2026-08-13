import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { OrderCreatedEvent } from './order-created.event';

describe('OrderCreatedEvent', () => {
  const validPayload = {
    orderId: 'order-1',
    orderNumber: 'ORD-1',
    userId: 'user-1',
    razorpayOrderId: 'order_razorpay_1',
    totalAmount: 1598,
    currency: 'INR',
    at: '2026-08-13T00:00:00.000Z',
  };

  it('defaults type and status to the fixed literal values', () => {
    const event = plainToInstance(OrderCreatedEvent, validPayload);

    expect(event.type).toBe('ORDER_CREATED');
    expect(event.status).toBe('PENDING_PAYMENT');
  });

  it('passes validation for a well-formed payload', async () => {
    const event = plainToInstance(OrderCreatedEvent, validPayload);

    const errors = await validate(event);

    expect(errors).toHaveLength(0);
  });

  it('fails validation when a required field is missing', async () => {
    const event = plainToInstance(OrderCreatedEvent, {
      ...validPayload,
      orderId: undefined,
    });

    const errors = await validate(event);

    expect(errors.some((error) => error.property === 'orderId')).toBe(true);
  });

  it('fails validation when at is not a valid ISO-8601 timestamp', async () => {
    const event = plainToInstance(OrderCreatedEvent, {
      ...validPayload,
      at: 'not-a-date',
    });

    const errors = await validate(event);

    expect(errors.some((error) => error.property === 'at')).toBe(true);
  });
});
