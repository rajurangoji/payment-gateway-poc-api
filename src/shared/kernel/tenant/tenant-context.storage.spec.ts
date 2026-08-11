import { AsyncLocalStorage } from 'async_hooks';

import { TenantContext, TenantContextStorage } from '@shared';

class MockTransactionContext {
  private static als = new AsyncLocalStorage<{
    transactionId: string;
  }>();

  static run<T>(transactionId: string, fn: () => Promise<T>): Promise<T> {
    return MockTransactionContext.als.run({ transactionId }, fn);
  }

  static get(): { transactionId: string } | undefined {
    return MockTransactionContext.als.getStore();
  }
}

describe('TenantContextStorage', () => {
  describe('basic functionality', () => {
    it('should store and retrieve tenant context', () => {
      const tenantContext: TenantContext = {
        businessUnit: 'BU1',
        countryCode: 'US',
      };

      TenantContextStorage.run(tenantContext, () => {
        const retrieved = TenantContextStorage.get();
        expect(retrieved).toEqual(tenantContext);
      });
    });

    it('should return undefined when no context is set', () => {
      const retrieved = TenantContextStorage.get();
      expect(retrieved).toBeUndefined();
    });
  });

  describe('async operations', () => {
    it('should maintain context across async operations', async () => {
      const tenantContext: TenantContext = {
        businessUnit: 'BU1',
        countryCode: 'US',
      };

      await TenantContextStorage.run(tenantContext, async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        const retrieved = TenantContextStorage.get();
        expect(retrieved).toEqual(tenantContext);

        // Nested async operation
        await Promise.resolve().then(() => {
          const nestedRetrieved = TenantContextStorage.get();
          expect(nestedRetrieved).toEqual(tenantContext);
        });
      });
    });
  });

  describe('nested AsyncLocalStorage contexts', () => {
    it('should work correctly when nested with another AsyncLocalStorage (like TransactionContext)', async () => {
      const tenantContext: TenantContext = {
        businessUnit: 'BU1',
        countryCode: 'US',
      };

      // Simulate the middleware setting tenant context
      await TenantContextStorage.run(tenantContext, async () => {
        // Verify tenant context is available
        expect(TenantContextStorage.get()).toEqual(tenantContext);

        // Simulate @Transactional decorator starting a transaction context
        await MockTransactionContext.run('txn-123', async () => {
          // Both contexts should be available
          expect(TenantContextStorage.get()).toEqual(tenantContext);
          expect(MockTransactionContext.get()?.transactionId).toBe('txn-123');

          // Simulate async database operation
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Both contexts should still be available after the async operation
          expect(TenantContextStorage.get()).toEqual(tenantContext);
          expect(MockTransactionContext.get()?.transactionId).toBe('txn-123');
        });

        // After the transaction context ends, tenant context should still be available
        expect(TenantContextStorage.get()).toEqual(tenantContext);
        expect(MockTransactionContext.get()).toBeUndefined();
      });
    });

    it('should support multiple nested transaction contexts within the same tenant context', async () => {
      const tenantContext: TenantContext = {
        businessUnit: 'BU1',
        countryCode: 'US',
      };

      await TenantContextStorage.run(tenantContext, async () => {
        // First transaction
        await MockTransactionContext.run('txn-1', async () => {
          expect(TenantContextStorage.get()).toEqual(tenantContext);
          expect(MockTransactionContext.get()?.transactionId).toBe('txn-1');
        });

        // Second transaction (sequential)
        await MockTransactionContext.run('txn-2', async () => {
          expect(TenantContextStorage.get()).toEqual(tenantContext);
          expect(MockTransactionContext.get()?.transactionId).toBe('txn-2');
        });

        // Tenant context should remain available
        expect(TenantContextStorage.get()).toEqual(tenantContext);
      });
    });
  });

  describe('isolation between requests', () => {
    it('should isolate tenant context between different request scopes', async () => {
      const tenant1: TenantContext = {
        businessUnit: 'BU1',
        countryCode: 'US',
      };

      const tenant2: TenantContext = {
        businessUnit: 'BU2',
        countryCode: 'CA',
      };

      // Simulate two concurrent requests
      await Promise.all([
        TenantContextStorage.run(tenant1, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          expect(TenantContextStorage.get()).toEqual(tenant1);
        }),
        TenantContextStorage.run(tenant2, async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          expect(TenantContextStorage.get()).toEqual(tenant2);
        }),
      ]);
    });
  });
});
