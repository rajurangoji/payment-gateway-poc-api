import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import {
  LatestPaymentStatusEnum,
  OrderStatusEnum,
  OrderSummaryDto,
} from '@generated/payments/payments.dto';

import { Order, OrderItem, Payment } from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSourceProvider: PaymentsDataSourceProvider,
  ) {}

  async listOrdersForUser(userId: string): Promise<OrderSummaryDto[]> {
    const dataSource = await this.dataSourceProvider.getDataSource();

    const orders = await dataSource.getRepository(Order).find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (orders.length === 0) {
      return [];
    }

    const orderIds = orders.map((order) => order.id);
    const [payments, items] = await Promise.all([
      dataSource
        .getRepository(Payment)
        .find({ where: { orderId: In(orderIds) } }),
      dataSource
        .getRepository(OrderItem)
        .find({ where: { orderId: In(orderIds) } }),
    ]);

    const paymentByOrderId = new Map(
      payments.map((payment) => [payment.orderId, payment]),
    );
    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const item of items) {
      const existing = itemsByOrderId.get(item.orderId) ?? [];
      existing.push(item);
      itemsByOrderId.set(item.orderId, existing);
    }

    return orders.map((order) => {
      const payment = paymentByOrderId.get(order.id);
      const orderItems = itemsByOrderId.get(order.id) ?? [];

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.status as unknown as OrderStatusEnum,
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        latestPaymentStatus: payment
          ? (payment.status as unknown as LatestPaymentStatusEnum)
          : undefined,
        items: orderItems.map((item) => ({
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalAmount: Number(item.totalAmount),
        })),
      };
    });
  }
}
