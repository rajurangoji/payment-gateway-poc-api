import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CANCELLED = 'CANCELLED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}

@Entity({ name: 'orders' })
export class Order {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'order_number', unique: true })
  orderNumber: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'subtotal_amount' })
  subtotalAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'discount_amount' })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'tax_amount' })
  taxAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'shipping_amount' })
  shippingAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: string;

  @Column({ type: 'varchar', length: 3, name: 'currency' })
  currency: string;

  @Column({ type: 'varchar', length: 50, name: 'status' })
  status: OrderStatus;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
