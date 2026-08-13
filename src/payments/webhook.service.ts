import { randomUUID } from 'crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { WebhookAckResponseDto } from '@generated/payments/payments.dto';

import { RazorpayConfig } from '../config/razorpay.config';

import {
  Order,
  OrderStatus,
  Payment,
  PaymentEvent,
  PaymentEventProcessingStatus,
  PaymentStatus,
  PaymentTransaction,
} from './entities';
import { PaymentsDataSourceProvider } from './payments-datasource.provider';
import { verifyWebhookSignature } from './razorpay-signature.util';

interface RazorpayWebhookEnvelope {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        error_code?: string;
        error_description?: string;
      };
    };
  };
}

@Injectable()
export class WebhookService {
  constructor(
    private readonly dataSourceProvider: PaymentsDataSourceProvider,
    private readonly razorpayConfig: RazorpayConfig,
  ) {}

  async handleWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookAckResponseDto> {
    const secret = this.razorpayConfig.webhookSecret ?? '';
    const signatureValid = verifyWebhookSignature(rawBody, signature, secret);
    // TEMP DEBUG - remove after diagnosing signature mismatch
    console.log('[webhook debug] secret length:', secret.length);
    console.log('[webhook debug] rawBody:', JSON.stringify(rawBody));
    console.log('[webhook debug] received signature:', signature);
    console.log(
      '[webhook debug] expected signature:',
      require('crypto')
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex'),
    );
    if (!signatureValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let envelope: RazorpayWebhookEnvelope;
    try {
      envelope = JSON.parse(rawBody) as RazorpayWebhookEnvelope;
    } catch {
      throw new BadRequestException('Malformed webhook payload');
    }

    const eventType = envelope.event ?? 'unknown';
    const entity = envelope.payload?.payment?.entity ?? {};
    const providerPaymentId = entity.id;
    const providerOrderId = entity.order_id;
    const eventId = `${eventType}:${providerPaymentId ?? providerOrderId ?? randomUUID()}`;

    const dataSource = await this.dataSourceProvider.getDataSource();

    const existingEvent = await dataSource
      .getRepository(PaymentEvent)
      .findOneBy({ eventId });
    if (existingEvent) {
      return this.ackResponse(
        eventId,
        PaymentEventProcessingStatus.DUPLICATE_IGNORED,
      );
    }

    let transaction: PaymentTransaction | null = null;
    if (providerPaymentId) {
      transaction = await dataSource
        .getRepository(PaymentTransaction)
        .findOneBy({ providerPaymentId });
    }
    if (!transaction && providerOrderId) {
      transaction = await dataSource
        .getRepository(PaymentTransaction)
        .findOneBy({ providerOrderId });
    }

    const event = new PaymentEvent();
    event.id = randomUUID();
    event.provider = 'RAZORPAY';
    event.eventId = eventId;
    event.eventType = eventType;
    event.providerPaymentId = providerPaymentId ?? null;
    event.providerOrderId = providerOrderId ?? null;
    event.payload = envelope as unknown as Record<string, unknown>;
    event.signature = signature;
    event.processedAt = new Date();
    event.errorMessage = null;
    event.createdAt = new Date();

    if (!transaction) {
      event.processingStatus = PaymentEventProcessingStatus.UNMATCHED;
      event.errorMessage = 'No matching payment_transactions row found';
      await dataSource.transaction(async (manager) => {
        await manager.save(event);
      });
      return this.ackResponse(eventId, PaymentEventProcessingStatus.UNMATCHED);
    }

    this.applyTransactionTransition(transaction, eventType, entity);

    const payment = await dataSource
      .getRepository(Payment)
      .findOneBy({ id: transaction.paymentId });
    const order = payment
      ? await dataSource.getRepository(Order).findOneBy({ id: payment.orderId })
      : null;

    this.applyPaymentAndOrderTransition(eventType, payment, order);

    event.processingStatus = PaymentEventProcessingStatus.PROCESSED;

    await dataSource.transaction(async (manager) => {
      await manager.save(transaction);
      if (payment) {
        await manager.save(payment);
      }
      if (order) {
        await manager.save(order);
      }
      await manager.save(event);
    });

    return this.ackResponse(eventId, PaymentEventProcessingStatus.PROCESSED);
  }

  private applyTransactionTransition(
    transaction: PaymentTransaction,
    eventType: string,
    entity: { error_code?: string; error_description?: string },
  ): void {
    transaction.updatedAt = new Date();
    if (eventType === 'payment.captured') {
      transaction.status = PaymentStatus.CAPTURED;
    } else if (eventType === 'payment.authorized') {
      transaction.status = PaymentStatus.AUTHORIZED;
    } else if (eventType === 'payment.failed') {
      transaction.status = PaymentStatus.FAILED;
      transaction.failureCode = entity.error_code ?? null;
      transaction.failureReason = entity.error_description ?? null;
    }
  }

  private applyPaymentAndOrderTransition(
    eventType: string,
    payment: Payment | null,
    order: Order | null,
  ): void {
    if (eventType === 'payment.captured') {
      if (payment) {
        payment.status = PaymentStatus.CAPTURED;
        payment.updatedAt = new Date();
      }
      if (order) {
        order.status = OrderStatus.PAID;
        order.updatedAt = new Date();
      }
    } else if (eventType === 'payment.failed') {
      if (payment) {
        payment.status = PaymentStatus.FAILED;
        payment.updatedAt = new Date();
      }
      if (order) {
        order.status = OrderStatus.PAYMENT_FAILED;
        order.updatedAt = new Date();
      }
    }
  }

  private ackResponse(
    eventId: string,
    processingStatus: PaymentEventProcessingStatus,
  ): WebhookAckResponseDto {
    return {
      received: true,
      eventId,
      processingStatus:
        processingStatus as unknown as WebhookAckResponseDto['processingStatus'],
    };
  }
}
