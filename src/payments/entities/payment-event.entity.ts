import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum PaymentEventProcessingStatus {
  PROCESSED = 'PROCESSED',
  DUPLICATE_IGNORED = 'DUPLICATE_IGNORED',
  UNMATCHED = 'UNMATCHED',
}

@Entity({ name: 'payment_events' })
export class PaymentEvent {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'provider' })
  provider: string;

  @Column({ type: 'varchar', length: 255, name: 'event_id', unique: true })
  eventId: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_payment_id',
    nullable: true,
  })
  providerPaymentId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_order_id',
    nullable: true,
  })
  providerOrderId: string | null;

  @Column({ type: 'jsonb', name: 'payload' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500, name: 'signature', nullable: true })
  signature: string | null;

  @Column({ type: 'varchar', length: 50, name: 'processing_status' })
  processingStatus: PaymentEventProcessingStatus;

  @Column({ type: 'timestamp', name: 'processed_at', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
