import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrdersTable1755000002000 implements MigrationInterface {
  name = 'CreateOrdersTable1755000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'order_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'subtotal_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'discount_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'tax_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'shipping_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'total_amount',
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
            name: 'IDX_orders_user_id',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_orders_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_orders_created_at',
            columnNames: ['created_at'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_orders_user_id',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders');
  }
}
