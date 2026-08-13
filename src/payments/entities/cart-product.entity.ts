import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum CartProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DISCONTINUED = 'DISCONTINUED',
}

@Entity({ name: 'cart_products' })
export class CartProduct {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 100, name: 'sku', unique: true })
  sku: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'price' })
  price: string;

  @Column({ type: 'varchar', length: 3, name: 'currency' })
  currency: string;

  @Column({ type: 'integer', name: 'stock_quantity' })
  stockQuantity: number;

  @Column({ type: 'varchar', length: 30, name: 'status' })
  status: CartProductStatus;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
