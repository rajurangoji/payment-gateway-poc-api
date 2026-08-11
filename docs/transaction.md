# Transaction Management

The `@Transactional` decorator provides Spring-like transaction management with support for propagation levels and isolation levels.

## Features

- **Propagation Levels**: Control how transactions are propagated across nested method calls
- **Isolation Levels**: Configure transaction isolation for different consistency requirements
- **Automatic Tenant Context**: Seamless integration with multi-tenant architecture
- **Nested Transaction Support**: Intelligent handling of nested transactional methods

## Basic Usage

```typescript
import { Transactional } from '@shared';

@Injectable({ scope: Scope.REQUEST })
export class MyService extends TransactionContext {
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly datasourceManager: DatasourceManager,
  ) {
    super();
  }

  @Transactional()
  async saveData(data: any): Promise<void> {
    // This method runs in a transaction
    await this.entityManager.save(MyEntity, data);
  }
}
```

## Propagation Levels

### REQUIRED (Default)
Use existing transaction if available, otherwise create a new one.

```typescript
@Transactional({ propagation: Propagation.REQUIRED })
async method1(): Promise<void> {
  // Creates new transaction if none exists
  await this.method2(); // Reuses the same transaction
}

@Transactional({ propagation: Propagation.REQUIRED })
async method2(): Promise<void> {
  // Uses existing transaction from method1
}
```

### REQUIRES_NEW
Always create a new transaction, suspending any existing transaction.

```typescript
@Transactional()
async outerMethod(): Promise<void> {
  await this.entityManager.save(Entity1, data1);
  
  // Inner method runs in separate transaction
  await this.innerMethod();
  
  // If innerMethod fails, outer transaction can still commit
}

@Transactional({ propagation: Propagation.REQUIRES_NEW })
async innerMethod(): Promise<void> {
  // Runs in completely separate transaction
  await this.entityManager.save(Entity2, data2);
}
```


## Isolation Levels

Control the transaction isolation level to balance consistency and performance.

### READ_COMMITTED (PostgreSQL Default)
Prevents dirty reads but allows non-repeatable reads.

```typescript
@Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
async standardRead(): Promise<void> {
  // Only reads committed data
  // Most common isolation level
}
```

### REPEATABLE_READ
Prevents dirty reads and non-repeatable reads.

```typescript
@Transactional({ isolationLevel: IsolationLevel.REPEATABLE_READ })
async consistentRead(): Promise<void> {
  // Ensures consistent reads throughout transaction
  // Prevents non-repeatable reads
}
```

### SERIALIZABLE
Highest isolation level, prevents all anomalies.

```typescript
@Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
async criticalOperation(): Promise<void> {
  // Strictest isolation
  // Prevents dirty reads, non-repeatable reads, and phantom reads
  // May have performance impact
}
```

## Combining Propagation and Isolation

```typescript
@Transactional({
  propagation: Propagation.REQUIRES_NEW,
  isolationLevel: IsolationLevel.SERIALIZABLE
})
async criticalAuditLog(data: AuditData): Promise<void> {
  // Always runs in separate transaction with strictest isolation
  // Ensures audit log is isolated from main transaction
  await this.entityManager.save(AuditLog, data);
}
```

## Nested Transaction Examples

### Example 1: Using Existing Transaction (Default)

```typescript
@Injectable({ scope: Scope.REQUEST })
export class OrderService extends TransactionContext {
  @Transactional()
  async createOrder(orderData: OrderDto): Promise<Order> {
    // Creates transaction
    const order = await this.entityManager.save(Order, orderData);
    
    // Reuses same transaction
    await this.createOrderItems(order.id, orderData.items);
    
    return order;
  }

  @Transactional() // Uses REQUIRED by default
  private async createOrderItems(orderId: number, items: ItemDto[]): Promise<void> {
    // Executes in parent transaction
    // If this fails, entire order creation is rolled back
    for (const item of items) {
      await this.entityManager.save(OrderItem, { orderId, ...item });
    }
  }
}
```

### Example 2: Independent Transaction for Logging

```typescript
@Injectable({ scope: Scope.REQUEST })
export class PaymentService extends TransactionContext {
  @Transactional()
  async processPayment(paymentData: PaymentDto): Promise<Payment> {
    try {
      const payment = await this.entityManager.save(Payment, paymentData);
      
      // Log in separate transaction - always persists even if payment fails
      await this.logPaymentAttempt(payment.id, 'SUCCESS');
      
      return payment;
    } catch (error) {
      // Log failure in separate transaction
      await this.logPaymentAttempt(paymentData.orderId, 'FAILED');
      throw error;
    }
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  private async logPaymentAttempt(referenceId: number, status: string): Promise<void> {
    // Runs in separate transaction
    // Always commits regardless of parent transaction outcome
    await this.entityManager.save(PaymentLog, { referenceId, status, timestamp: new Date() });
  }
}
```

## Best Practices

1. **Use REQUIRED (default) for most cases**: It provides the right balance between safety and simplicity.

2. **Use REQUIRES_NEW for independent operations**: 
   - Logging/auditing that must persist regardless of the main transaction
   - Operations that should not affect or be affected by parent transaction

3. **Choose appropriate isolation levels**:
   - READ_COMMITTED for most operations
   - REPEATABLE_READ for consistent reporting
   - SERIALIZABLE only when necessary (financial transactions, critical data)

4. **Keep transactions short**:
   - Avoid long-running operations in transactions
   - Move non-critical operations outside transaction boundaries

5. **Always extend TransactionContext**:
   - Required for accessing `entityManager` in transaction scope
   - Enables seamless integration with multi-tenant architecture

## Error Handling

Transaction failures automatically trigger rollback:

```typescript
@Transactional()
async complexOperation(): Promise<void> {
  try {
    await this.entityManager.save(Entity1, data1);
    await this.riskyOperation(); // If this throws, transaction rolls back
    await this.entityManager.save(Entity2, data2);
  } catch (error) {
    this.logger.error('Operation failed', error);
    throw error; // Re-throw to propagate error, and rollback transaction
  }
}
```

## Multi-Tenant Support

The decorator automatically integrates with the multi-tenant architecture:

```typescript
@Transactional()
async saveCustomerData(data: CustomerDto): Promise<void> {
  // Tenant context is automatically extracted from headers
  // Correct database connection is used based on businessUnit and countryCode
  // Schema is automatically set
  await this.entityManager.save(Customer, data);
}
```

Required headers:
- `x-business-unit` (or `businessUnit`)
- `x-country-code` (or `countryCode`)
