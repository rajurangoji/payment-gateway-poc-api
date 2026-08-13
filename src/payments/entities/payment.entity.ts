import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum PaymentStatus {
  CREATED = 'CREATED',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'order_id', unique: true })
  orderId: string;

  @Column({ type: 'varchar', length: 50, name: 'provider' })
  provider: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'amount' })
  amount: string;

  @Column({ type: 'varchar', length: 3, name: 'currency' })
  currency: string;

  @Column({ type: 'varchar', length: 50, name: 'status' })
  status: PaymentStatus;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
