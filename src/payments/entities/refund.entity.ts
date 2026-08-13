import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum RefundStatus {
  CREATED = 'CREATED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Entity({ name: 'refunds' })
export class Refund {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'payment_transaction_id' })
  paymentTransactionId: string;

  @Column({ type: 'varchar', length: 50, name: 'provider' })
  provider: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_refund_id',
    unique: true,
  })
  providerRefundId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'amount' })
  amount: string;

  @Column({ type: 'varchar', length: 3, name: 'currency' })
  currency: string;

  @Column({ type: 'varchar', length: 50, name: 'status' })
  status: RefundStatus;

  @Column({ type: 'text', name: 'reason', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', name: 'provider_response', nullable: true })
  providerResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
