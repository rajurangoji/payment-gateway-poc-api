import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { VerifyPaymentResponseDto } from '@generated/payments/payments.dto';

import { RazorpayConfig } from '../../config/razorpay.config';
import {
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  PaymentTransaction,
} from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';
import { verifyPaymentSignature } from '../utils/razorpay-signature.util';

@Injectable()
export class PaymentVerificationService {
  constructor(
    private readonly dataSourceProvider: PaymentsDataSourceProvider,
    private readonly razorpayConfig: RazorpayConfig,
  ) {}

  async verifyPayment(
    orderId: string,
    razorpayPaymentId: string,
    razorpayOrderId: string,
    razorpaySignature: string,
  ): Promise<VerifyPaymentResponseDto> {
    if (
      !orderId ||
      !razorpayPaymentId ||
      !razorpayOrderId ||
      !razorpaySignature
    ) {
      throw new BadRequestException(
        'orderId, razorpayPaymentId, razorpayOrderId, and razorpaySignature are all required',
      );
    }

    const dataSource = await this.dataSourceProvider.getDataSource();

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

    if (transaction.status === PaymentStatus.CAPTURED) {
      if (transaction.providerPaymentId === razorpayPaymentId) {
        return this.paidResponse(orderId);
      }
      throw new UnprocessableEntityException(
        'Payment already captured with a different payment id',
      );
    }

    const signatureValid = verifyPaymentSignature(
      transaction.providerOrderId ?? '',
      razorpayPaymentId,
      razorpaySignature,
      this.razorpayConfig.keySecret,
    );

    if (!signatureValid) {
      transaction.status = PaymentStatus.FAILED;
      transaction.updatedAt = new Date();
      await dataSource.transaction(async (manager) => {
        await manager.save(transaction);
      });
      throw new UnprocessableEntityException(
        'Payment signature verification failed',
      );
    }

    transaction.status = PaymentStatus.CAPTURED;
    transaction.providerPaymentId = razorpayPaymentId;
    transaction.updatedAt = new Date();

    payment.status = PaymentStatus.CAPTURED;
    payment.updatedAt = new Date();

    const order = await dataSource
      .getRepository(Order)
      .findOneBy({ id: orderId });
    if (order) {
      order.status = OrderStatus.PAID;
      order.updatedAt = new Date();
    }

    await dataSource.transaction(async (manager) => {
      await manager.save(transaction);
      await manager.save(payment);
      if (order) {
        await manager.save(order);
      }
    });

    return this.paidResponse(orderId);
  }

  private paidResponse(orderId: string): VerifyPaymentResponseDto {
    return {
      orderId,
      status: OrderStatus.PAID as unknown as VerifyPaymentResponseDto['status'],
      paymentStatus:
        PaymentStatus.CAPTURED as unknown as VerifyPaymentResponseDto['paymentStatus'],
    };
  }
}
