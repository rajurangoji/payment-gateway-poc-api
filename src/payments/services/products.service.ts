import { Injectable } from '@nestjs/common';

import { ProductDtoDto, StatusEnum } from '@generated/payments/payments.dto';

import { CartProduct, CartProductStatus } from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';

@Injectable()
export class ProductsService {
  constructor(
    private readonly dataSourceProvider: PaymentsDataSourceProvider,
  ) {}

  async findActiveProducts(): Promise<ProductDtoDto[]> {
    const dataSource = await this.dataSourceProvider.getDataSource();
    const products = await dataSource.getRepository(CartProduct).find({
      where: { status: CartProductStatus.ACTIVE },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      currency: product.currency,
      stockQuantity: product.stockQuantity,
      status: product.status as unknown as StatusEnum,
    }));
  }
}
