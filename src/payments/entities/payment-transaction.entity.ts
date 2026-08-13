import { Column, Entity, PrimaryColumn } from 'typeorm';

import { PaymentStatus } from './payment.entity';

@Entity({ name: 'payment_transactions' })
export class PaymentTransaction {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId: string;

  @Column({ type: 'varchar', length: 50, name: 'provider' })
  provider: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_order_id',
    nullable: true,
  })
  providerOrderId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_payment_id',
    nullable: true,
    unique: true,
  })
  providerPaymentId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'amount' })
  amount: string;

  @Column({ type: 'varchar', length: 3, name: 'currency' })
  currency: string;

  @Column({ type: 'varchar', length: 50, name: 'status' })
  status: PaymentStatus;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_method',
    nullable: true,
  })
  paymentMethod: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'failure_code',
    nullable: true,
  })
  failureCode: string | null;

  @Column({ type: 'text', name: 'failure_reason', nullable: true })
  failureReason: string | null;

  @Column({ type: 'jsonb', name: 'provider_response', nullable: true })
  providerResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
