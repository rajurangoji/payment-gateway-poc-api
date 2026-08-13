import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'varchar', length: 255, name: 'product_name' })
  productName: string;

  @Column({ type: 'varchar', length: 100, name: 'sku' })
  sku: string;

  @Column({ type: 'integer', name: 'quantity' })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'discount_amount' })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'tax_amount' })
  taxAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: string;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
