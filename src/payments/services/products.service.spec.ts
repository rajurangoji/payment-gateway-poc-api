import { CartProduct, CartProductStatus } from '../entities';
import { PaymentsDataSourceProvider } from '../providers/payments-datasource.provider';

import { ProductsService } from './products.service';

function cartProduct(overrides: Partial<CartProduct>): CartProduct {
  const product = new CartProduct();
  product.id = 'product-1';
  product.userId = 'user-1';
  product.name = 'Wireless Mouse';
  product.sku = 'SKU-MOUSE-001';
  product.price = '799.00';
  product.currency = 'INR';
  product.stockQuantity = 120;
  product.status = CartProductStatus.ACTIVE;
  product.createdAt = new Date();
  product.updatedAt = new Date();
  return Object.assign(product, overrides);
}

describe('ProductsService', () => {
  let findMock: jest.Mock;
  let service: ProductsService;

  beforeEach(() => {
    findMock = jest.fn();
    const dataSourceProvider = {
      getDataSource: jest.fn().mockResolvedValue({
        getRepository: () => ({ find: findMock }),
      }),
    } as unknown as PaymentsDataSourceProvider;

    service = new ProductsService(dataSourceProvider);
  });

  it('returns only ACTIVE products mapped to the documented shape', async () => {
    findMock.mockResolvedValue([cartProduct({})]);

    const result = await service.findActiveProducts();

    expect(findMock).toHaveBeenCalledWith({
      where: { status: CartProductStatus.ACTIVE },
    });
    expect(result).toEqual([
      {
        id: 'product-1',
        name: 'Wireless Mouse',
        sku: 'SKU-MOUSE-001',
        price: 799,
        currency: 'INR',
        stockQuantity: 120,
        status: 'ACTIVE',
      },
    ]);
  });

  it('returns an empty array when there are no active products', async () => {
    findMock.mockResolvedValue([]);

    const result = await service.findActiveProducts();

    expect(result).toEqual([]);
  });
});
