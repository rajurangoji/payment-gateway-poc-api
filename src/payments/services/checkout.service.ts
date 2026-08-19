import { randomUUID } from 'crypto';

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';

import {
  CheckoutItemDto,
  CreateCheckoutOrderResponseDto,
} from '@generated/payments/payments.dto';

import { RazorpayConfig } from '../../config/razorpay.config';
import { RazorpayApiError } from '../clients/razorpay-api.error';
import {
  RazorpayClientService,
  RazorpayOrderResult,
} from '../clients/razorpay-client.service';
import {
  CartProduct,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentStatus,
  PaymentTransaction,
  User,
} from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly dataSourceProvider: PaymentsDataSourceProvider,
    private readonly razorpayClient: RazorpayClientService,
    private readonly razorpayConfig: RazorpayConfig,
  ) {}

  async createOrder(
    userId: string,
    items: CheckoutItemDto[],
  ): Promise<CreateCheckoutOrderResponseDto> {
    if (items.length === 0) {
      throw new BadRequestException('items must not be empty');
    }
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          `quantity must be a positive integer for product ${item.productId}`,
        );
      }
    }

    const dataSource = await this.dataSourceProvider.getDataSource();

    const user = await dataSource.getRepository(User).findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const productIds = items.map((item) => item.productId);
    const products = await dataSource
      .getRepository(CartProduct)
      .find({ where: { id: In(productIds) } });
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      if (item.quantity > product.stockQuantity) {
        throw new ConflictException(
          `Insufficient stock for product ${product.sku}`,
        );
      }
    }

    const { orderItems, subtotalAmount, currency } = this.buildOrderItems(
      items,
      productById,
    );
    const totalAmount = subtotalAmount;

    const order = new Order();
    order.id = randomUUID();
    order.orderNumber = this.generateOrderNumber();
    order.userId = userId;
    order.subtotalAmount = subtotalAmount.toFixed(2);
    order.discountAmount = '0.00';
    order.taxAmount = '0.00';
    order.shippingAmount = '0.00';
    order.totalAmount = totalAmount.toFixed(2);
    order.currency = currency;
    order.status = OrderStatus.PENDING_PAYMENT;
    order.createdAt = new Date();
    order.updatedAt = new Date();

    for (const orderItem of orderItems) {
      orderItem.orderId = order.id;
    }

    const amountPaise = Math.round(totalAmount * 100);

    let razorpayOrder: RazorpayOrderResult;
    try {
      razorpayOrder = await this.razorpayClient.createOrder(
        amountPaise,
        currency,
        order.orderNumber,
      );
    } catch (error) {
      if (error instanceof RazorpayApiError) {
        throw new BadGatewayException(
          'Razorpay Orders API is currently unavailable',
        );
      }
      throw error;
    }

    const { payment, paymentTransaction } = this.buildPaymentRecords(
      order.id,
      razorpayOrder.id,
      totalAmount,
      currency,
    );

    await dataSource.transaction(async (manager) => {
      await manager.save(order);
      await manager.save(orderItems);
      await manager.save(payment);
      await manager.save(paymentTransaction);
    });

    return {
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency,
      keyId: this.razorpayConfig.keyId,
    };
  }

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = randomUUID().split('-')[0].toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
  }

  private buildOrderItems(
    items: CheckoutItemDto[],
    productById: Map<string, CartProduct>,
  ): { orderItems: OrderItem[]; subtotalAmount: number; currency: string } {
    let subtotalAmount = 0;
    const orderItems: OrderItem[] = [];
    let currency = 'INR';

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        continue;
      }
      currency = product.currency;
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;
      subtotalAmount += lineTotal;

      const orderItem = new OrderItem();
      orderItem.id = randomUUID();
      orderItem.productId = product.id;
      orderItem.productName = product.name;
      orderItem.sku = product.sku;
      orderItem.quantity = item.quantity;
      orderItem.unitPrice = unitPrice.toFixed(2);
      orderItem.discountAmount = '0.00';
      orderItem.taxAmount = '0.00';
      orderItem.totalAmount = lineTotal.toFixed(2);
      orderItem.createdAt = new Date();
      orderItems.push(orderItem);
    }

    return { orderItems, subtotalAmount, currency };
  }

  private buildPaymentRecords(
    orderId: string,
    razorpayOrderId: string,
    totalAmount: number,
    currency: string,
  ): { payment: Payment; paymentTransaction: PaymentTransaction } {
    const payment = new Payment();
    payment.id = randomUUID();
    payment.orderId = orderId;
    payment.provider = 'RAZORPAY';
    payment.amount = totalAmount.toFixed(2);
    payment.currency = currency;
    payment.status = PaymentStatus.CREATED;
    payment.createdAt = new Date();
    payment.updatedAt = new Date();

    const paymentTransaction = new PaymentTransaction();
    paymentTransaction.id = randomUUID();
    paymentTransaction.paymentId = payment.id;
    paymentTransaction.provider = 'RAZORPAY';
    paymentTransaction.providerOrderId = razorpayOrderId;
    paymentTransaction.providerPaymentId = null;
    paymentTransaction.amount = totalAmount.toFixed(2);
    paymentTransaction.currency = currency;
    paymentTransaction.status = PaymentStatus.CREATED;
    paymentTransaction.paymentMethod = null;
    paymentTransaction.failureCode = null;
    paymentTransaction.failureReason = null;
    paymentTransaction.providerResponse = null;
    paymentTransaction.createdAt = new Date();
    paymentTransaction.updatedAt = new Date();

    return { payment, paymentTransaction };
  }
}
