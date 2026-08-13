import { GetQueueUrlCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PinoLogger } from 'nestjs-pino';

import { OrderCreatedEvent } from './order-created.event';
import { OrderEventsQueueConfig } from './order-events-queue.config';
import { OrderEventsPublisher } from './order-events.publisher';

describe('OrderEventsPublisher', () => {
  let sendMock: jest.Mock;
  let publisher: OrderEventsPublisher;
  let logger: PinoLogger;

  const queueConfig = new OrderEventsQueueConfig();
  queueConfig.name = 'order-events-queue';

  const payload: OrderCreatedEvent = {
    type: 'ORDER_CREATED',
    orderId: 'order-1',
    orderNumber: 'ORD-1',
    userId: 'user-1',
    razorpayOrderId: 'order_razorpay_1',
    totalAmount: 2499,
    currency: 'INR',
    status: 'PENDING_PAYMENT',
    at: '2026-08-13T00:00:00.000Z',
  };

  beforeEach(() => {
    sendMock = jest.fn().mockImplementation((command) => {
      if (command instanceof GetQueueUrlCommand) {
        return Promise.resolve({
          QueueUrl: 'https://sqs.test/order-events-queue',
        });
      }
      if (command instanceof SendMessageCommand) {
        return Promise.resolve({ MessageId: 'msg-1' });
      }
      return Promise.reject(new Error('unexpected command'));
    });

    logger = { error: jest.fn(), info: jest.fn() } as unknown as PinoLogger;

    publisher = new OrderEventsPublisher(
      { send: sendMock } as never,
      queueConfig,
      logger,
    );
  });

  it('sends the ORDER_CREATED envelope to the resolved queue URL', async () => {
    await publisher.publishOrderCreated(payload);

    expect(sendMock).toHaveBeenCalledWith(expect.any(GetQueueUrlCommand));
    const calls = sendMock.mock.calls as [unknown][];
    const sendMessageCall = calls.find(
      ([command]) => command instanceof SendMessageCommand,
    );
    expect(sendMessageCall).toBeDefined();
    const [sendMessageCommand] = sendMessageCall as [SendMessageCommand];
    expect(sendMessageCommand.input.QueueUrl).toBe(
      'https://sqs.test/order-events-queue',
    );
    expect(JSON.parse(sendMessageCommand.input.MessageBody as string)).toEqual(
      payload,
    );
  });

  it('does not throw when the SQS call fails, and logs the error', async () => {
    sendMock.mockImplementation((command) => {
      if (command instanceof GetQueueUrlCommand) {
        return Promise.resolve({
          QueueUrl: 'https://sqs.test/order-events-queue',
        });
      }
      return Promise.reject(new Error('sqs unavailable'));
    });

    await expect(publisher.publishOrderCreated(payload)).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });

  it('sends a separate message per call for two distinct orders', async () => {
    await publisher.publishOrderCreated(payload);
    await publisher.publishOrderCreated({ ...payload, orderId: 'order-2' });

    const sendMessageCalls = sendMock.mock.calls.filter(
      ([command]) => command instanceof SendMessageCommand,
    );
    expect(sendMessageCalls).toHaveLength(2);
  });
});
