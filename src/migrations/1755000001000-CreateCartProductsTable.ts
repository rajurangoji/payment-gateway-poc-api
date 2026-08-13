import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateCartProductsTable1755000001000 implements MigrationInterface {
  name = 'CreateCartProductsTable1755000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'cart_products',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'price',
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
            name: 'stock_quantity',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            isNullable: false,
            default: "'ACTIVE'",
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
            name: 'IDX_cart_products_user_id',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_cart_products_status',
            columnNames: ['status'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_cart_products_user_id',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cart_products');
  }
}
