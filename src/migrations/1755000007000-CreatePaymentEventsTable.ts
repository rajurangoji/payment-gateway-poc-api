import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePaymentEventsTable1755000007000 implements MigrationInterface {
  name = 'CreatePaymentEventsTable1755000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'event_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'event_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'provider_payment_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'provider_order_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'signature',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'processing_status',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
        indices: [
          {
            name: 'IDX_payment_events_provider_payment_id',
            columnNames: ['provider_payment_id'],
          },
          {
            name: 'IDX_payment_events_provider_order_id',
            columnNames: ['provider_order_id'],
          },
          {
            name: 'IDX_payment_events_processing_status',
            columnNames: ['processing_status'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_events');
  }
}
