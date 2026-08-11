import { AsyncLocalStorage } from 'async_hooks';

import { TenantContext } from './tenant-context';

class TenantContextStorage {
  private static als = new AsyncLocalStorage<TenantContext>();

  static run<T>(tenantContext: TenantContext, fn: () => T): T {
    return TenantContextStorage.als.run(tenantContext, fn);
  }

  static get(): TenantContext | undefined {
    return TenantContextStorage.als.getStore();
  }
}

export { TenantContextStorage };
