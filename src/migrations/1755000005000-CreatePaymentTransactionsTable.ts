import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePaymentTransactionsTable1755000005000 implements MigrationInterface {
  name = 'CreatePaymentTransactionsTable1755000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'payment_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'provider_order_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'provider_payment_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'failure_code',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'provider_response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
        indices: [
          {
            name: 'IDX_payment_transactions_payment_id',
            columnNames: ['payment_id'],
          },
          {
            name: 'IDX_payment_transactions_provider_order_id',
            columnNames: ['provider_order_id'],
          },
          {
            name: 'IDX_payment_transactions_status',
            columnNames: ['status'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_payment_transactions_payment_id',
            columnNames: ['payment_id'],
            referencedTableName: 'payments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_transactions');
  }
}
