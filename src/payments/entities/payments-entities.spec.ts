import { getMetadataArgsStorage } from 'typeorm';

import { CartProduct } from './cart-product.entity';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';
import { PaymentEvent } from './payment-event.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { Payment } from './payment.entity';
import { Refund } from './refund.entity';
import { User } from './user.entity';

interface ExpectedColumn {
  property: string;
  dbName: string;
}

interface ExpectedEntity {
  entity: new () => unknown;
  tableName: string;
  columns: ExpectedColumn[];
}

const EXPECTED: ExpectedEntity[] = [
  {
    entity: User,
    tableName: 'users',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'email', dbName: 'email' },
      { property: 'name', dbName: 'name' },
      { property: 'phone', dbName: 'phone' },
      { property: 'createdAt', dbName: 'created_at' },
      { property: 'updatedAt', dbName: 'updated_at' },
    ],
  },
  {
    entity: CartProduct,
    tableName: 'cart_products',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'userId', dbName: 'user_id' },
      { property: 'name', dbName: 'name' },
      { property: 'sku', dbName: 'sku' },
      { property: 'price', dbName: 'price' },
      { property: 'currency', dbName: 'currency' },
      { property: 'stockQuantity', dbName: 'stock_quantity' },
      { property: 'status', dbName: 'status' },
      { property: 'createdAt', dbName: 'created_at' },
      { property: 'updatedAt', dbName: 'updated_at' },
    ],
  },
  {
    entity: Order,
    tableName: 'orders',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'orderNumber', dbName: 'order_number' },
      { property: 'userId', dbName: 'user_id' },
      { property: 'subtotalAmount', dbName: 'subtotal_amount' },
      { property: 'discountAmount', dbName: 'discount_amount' },
      { property: 'taxAmount', dbName: 'tax_amount' },
      { property: 'shippingAmount', dbName: 'shipping_amount' },
      { property: 'totalAmount', dbName: 'total_amount' },
      { property: 'currency', dbName: 'currency' },
      { property: 'status', dbName: 'status' },
      { property: 'createdAt', dbName: 'created_at' },
      { property: 'updatedAt', dbName: 'updated_at' },
    ],
  },
  {
    entity: OrderItem,
    tableName: 'order_items',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'orderId', dbName: 'order_id' },
      { property: 'productId', dbName: 'product_id' },
      { property: 'productName', dbName: 'product_name' },
      { property: 'sku', dbName: 'sku' },
      { property: 'quantity', dbName: 'quantity' },
      { property: 'unitPrice', dbName: 'unit_price' },
      { property: 'discountAmount', dbName: 'discount_amount' },
      { property: 'taxAmount', dbName: 'tax_amount' },
      { property: 'totalAmount', dbName: 'total_amount' },
      { property: 'createdAt', dbName: 'created_at' },
    ],
  },
  {
    entity: Payment,
    tableName: 'payments',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'orderId', dbName: 'order_id' },
      { property: 'provider', dbName: 'provider' },
      { property: 'amount', dbName: 'amount' },
      { property: 'currency', dbName: 'currency' },
      { property: 'status', dbName: 'status' },
      { property: 'createdAt', dbName: 'created_at' },
      { property: 'updatedAt', dbName: 'updated_at' },
    ],
  },
  {
    entity: PaymentTransaction,
    tableName: 'payment_transactions',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'paymentId', dbName: 'payment_id' },
      { property: 'provider', dbName: 'provider' },
      { property: 'providerOrderId', dbName: 'provider_order_id' },
      { property: 'providerPaymentId', dbName: 'provider_payment_id' },
      { property: 'amount', dbName: 'amount' },
      { property: 'currency', dbName: 'currency' },
      { property: 'status', dbName: 'status' },
      { property: 'paymentMethod', dbName: 'payment_method' },
      { property: 'failureCode', dbName: 'failure_code' },
      { property: 'failureReason', dbName: 'failure_reason' },
      { property: 'providerResponse', dbName: 'provider_response' },
      { property: 'createdAt', dbName: 'created_at' },
      { property: 'updatedAt', dbName: 'updated_at' },
    ],
  },
  {
    entity: Refund,
    tableName: 'refunds',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'paymentTransactionId', dbName: 'payment_transaction_id' },
      { property: 'provider', dbName: 'provider' },
      { property: 'providerRefundId', dbName: 'provider_refund_id' },
      { property: 'amount', dbName: 'amount' },
      { property: 'currency', dbName: 'currency' },
      { property: 'status', dbName: 'status' },
      { property: 'reason', dbName: 'reason' },
      { property: 'providerResponse', dbName: 'provider_response' },
      { property: 'createdAt', dbName: 'created_at' },
      { property: 'updatedAt', dbName: 'updated_at' },
    ],
  },
  {
    entity: PaymentEvent,
    tableName: 'payment_events',
    columns: [
      { property: 'id', dbName: 'id' },
      { property: 'provider', dbName: 'provider' },
      { property: 'eventId', dbName: 'event_id' },
      { property: 'eventType', dbName: 'event_type' },
      { property: 'providerPaymentId', dbName: 'provider_payment_id' },
      { property: 'providerOrderId', dbName: 'provider_order_id' },
      { property: 'payload', dbName: 'payload' },
      { property: 'signature', dbName: 'signature' },
      { property: 'processingStatus', dbName: 'processing_status' },
      { property: 'processedAt', dbName: 'processed_at' },
      { property: 'errorMessage', dbName: 'error_message' },
      { property: 'createdAt', dbName: 'created_at' },
    ],
  },
];

describe('Payments domain entities', () => {
  it.each(EXPECTED.map((e) => [e.tableName, e]))(
    'maps %s to the correct table and columns',
    (_tableName, expected) => {
      const { entity, tableName, columns } = expected as ExpectedEntity;
      const metadata = getMetadataArgsStorage();

      const table = metadata.tables.find((t) => t.target === entity);
      expect(table).toBeDefined();
      expect(table?.name).toBe(tableName);

      const entityColumns = metadata.columns.filter((c) => c.target === entity);

      for (const expectedColumn of columns) {
        const column = entityColumns.find(
          (c) => c.propertyName === expectedColumn.property,
        );
        expect(column).toBeDefined();
        expect(column?.options.name).toBe(expectedColumn.dbName);
      }
    },
  );

  it('marks the id column as primary on every entity', () => {
    const metadata = getMetadataArgsStorage();
    for (const { entity } of EXPECTED) {
      const primaryColumns = metadata.columns.filter(
        (c) => c.target === entity && c.options.primary === true,
      );
      expect(primaryColumns.map((c) => c.propertyName)).toContain('id');
    }
  });
});
