import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

import { EntityManager } from 'typeorm';

interface TransactionContextData {
  entityManager: EntityManager;
  transactionId: string;
}

class TransactionContext {
  private static als = new AsyncLocalStorage<TransactionContextData>();

  static run<T>(
    entityManager: EntityManager,
    fn: () => Promise<T>,
    transactionId?: string,
  ): Promise<T> {
    const txId = transactionId ?? randomUUID();
    return TransactionContext.als.run(
      { entityManager, transactionId: txId },
      fn,
    );
  }

  static getEntityManager(): EntityManager | undefined {
    const context = TransactionContext.als.getStore();
    return context?.entityManager;
  }

  static getTransactionId(): string | undefined {
    const context = TransactionContext.als.getStore();
    return context?.transactionId;
  }

  protected get entityManager(): EntityManager {
    const context = TransactionContext.als.getStore();
    if (!context) {
      throw new Error('No transaction context available');
    }
    return context.entityManager;
  }
}

export { TransactionContext };
