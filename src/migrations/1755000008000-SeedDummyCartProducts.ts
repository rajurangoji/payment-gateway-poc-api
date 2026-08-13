import { MigrationInterface, QueryRunner } from 'typeorm';

const DEMO_USER_EMAIL = 'demo.buyer@example.com';

const DUMMY_PRODUCTS = [
  {
    name: 'Wireless Mouse',
    sku: 'SKU-MOUSE-001',
    price: 799.0,
    stockQuantity: 120,
  },
  {
    name: 'Mechanical Keyboard',
    sku: 'SKU-KEYBOARD-001',
    price: 3499.0,
    stockQuantity: 45,
  },
  {
    name: 'USB-C Hub',
    sku: 'SKU-HUB-001',
    price: 1999.0,
    stockQuantity: 80,
  },
  {
    name: 'Noise Cancelling Headphones',
    sku: 'SKU-HEADPHONES-001',
    price: 5999.0,
    stockQuantity: 30,
  },
  {
    name: 'Laptop Stand',
    sku: 'SKU-STAND-001',
    price: 1299.0,
    stockQuantity: 60,
  },
] as const;

export class SeedDummyCartProducts1755000008000 implements MigrationInterface {
  name = 'SeedDummyCartProducts1755000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [demoUser] = (await queryRunner.query(
      `INSERT INTO users (email, name, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [DEMO_USER_EMAIL, 'Demo Buyer', '+919999999999'],
    )) as Array<{ id: string }>;

    for (const product of DUMMY_PRODUCTS) {
      await queryRunner.query(
        `INSERT INTO cart_products (user_id, name, sku, price, currency, stock_quantity, status)
         VALUES ($1, $2, $3, $4, 'INR', $5, 'ACTIVE')
         ON CONFLICT (sku) DO NOTHING`,
        [
          demoUser.id,
          product.name,
          product.sku,
          product.price,
          product.stockQuantity,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const skus = DUMMY_PRODUCTS.map((product) => product.sku);
    await queryRunner.query(`DELETE FROM cart_products WHERE sku = ANY($1)`, [
      skus,
    ]);
    await queryRunner.query(`DELETE FROM users WHERE email = $1`, [
      DEMO_USER_EMAIL,
    ]);
  }
}
