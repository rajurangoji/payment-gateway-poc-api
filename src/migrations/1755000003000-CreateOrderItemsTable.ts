import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrderItemsTable1755000003000 implements MigrationInterface {
  name = 'CreateOrderItemsTable1755000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'order_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'unit_price',
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
            name: 'total_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
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
            name: 'IDX_order_items_order_id',
            columnNames: ['order_id'],
          },
          {
            name: 'IDX_order_items_product_id',
            columnNames: ['product_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_order_items_order_id',
            columnNames: ['order_id'],
            referencedTableName: 'orders',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_order_items_product_id',
            columnNames: ['product_id'],
            referencedTableName: 'cart_products',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_items');
  }
}
