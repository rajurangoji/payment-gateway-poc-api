import { randomUUID } from 'crypto';

import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RefundResponseDto } from '@generated/payments/payments.dto';

import {
  Order,
  OrderStatus,
  Payment,
  PaymentTransaction,
  Refund,
  RefundStatus,
} from './entities';
import { PaymentsDataSourceProvider } from './payments-datasource.provider';
import { RazorpayApiError } from './razorpay-api.error';
import {
  RazorpayClientService,
  RazorpayRefundResult,
} from './razorpay-client.service';

@Injectable()
export class RefundsService {
  constructor(
    private readonly dataSourceProvider: PaymentsDataSourceProvider,
    private readonly razorpayClient: RazorpayClientService,
  ) {}

  async refundOrder(orderId: string): Promise<RefundResponseDto> {
    const dataSource = await this.dataSourceProvider.getDataSource();

    const order = await dataSource
      .getRepository(Order)
      .findOneBy({ id: orderId });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException(
        `Order ${orderId} is not in a refundable state`,
      );
    }

    const payment = await dataSource
      .getRepository(Payment)
      .findOneBy({ orderId });
    if (!payment) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const transaction = await dataSource
      .getRepository(PaymentTransaction)
      .findOneBy({ paymentId: payment.id });
    if (!transaction) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const existingRefund = await dataSource
      .getRepository(Refund)
      .findOneBy({ paymentTransactionId: transaction.id });
    if (existingRefund) {
      throw new ConflictException(`Order ${orderId} has already been refunded`);
    }

    const amountPaise = Math.round(Number(transaction.amount) * 100);
    let razorpayRefund: RazorpayRefundResult;
    try {
      razorpayRefund = await this.razorpayClient.createRefund(
        transaction.providerPaymentId ?? '',
        amountPaise,
      );
    } catch (error) {
      if (error instanceof RazorpayApiError) {
        throw new BadGatewayException(
          'Razorpay Refunds API is currently unavailable',
        );
      }
      throw error;
    }

    const refund = new Refund();
    refund.id = randomUUID();
    refund.paymentTransactionId = transaction.id;
    refund.provider = 'RAZORPAY';
    refund.providerRefundId = razorpayRefund.id;
    refund.amount = transaction.amount;
    refund.currency = transaction.currency;
    refund.status = RefundStatus.CREATED;
    refund.reason = null;
    refund.providerResponse = null;
    refund.createdAt = new Date();
    refund.updatedAt = new Date();

    order.status = OrderStatus.REFUND_PENDING;
    order.updatedAt = new Date();

    await dataSource.transaction(async (manager) => {
      await manager.save(refund);
      await manager.save(order);
    });

    return {
      orderId,
      refundId: refund.id,
      providerRefundId: razorpayRefund.id,
      status:
        OrderStatus.REFUND_PENDING as unknown as RefundResponseDto['status'],
    };
  }
}
