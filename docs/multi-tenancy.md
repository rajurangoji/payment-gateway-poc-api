# Multi-Tenancy Architecture

This document provides a comprehensive guide to the multi-tenancy implementation in this project. The system supports **schema-based multi-tenancy** with automatic tenant context management and database routing.

## Architecture Overview

The multi-tenancy system consists of several key components that work together to provide seamless tenant isolation:

1. **TenantContext**: Data structure holding tenant identification
2. **TenantContextStorage**: AsyncLocalStorage for context propagation
3. **TenantContextMiddleware**: Extracts tenant info from HTTP headers
4. **DatasourceManager**: Manages per-tenant database connections
5. **@Transactional Decorator**: Integrates tenant context with transactions

## Tenant Context Structure

```typescript
export interface TenantContext {
  businessUnit: string;  // e.g., 'serhafen', 'logistics'
  countryCode: string;   // e.g., 'us', 'de', 'fr'
}
```

## Component Details

### 1. TenantContextStorage

**Purpose**: Propagate tenant context throughout the async call chain using Node.js AsyncLocalStorage.

**Implementation**:
```typescript
import { AsyncLocalStorage } from 'async_hooks';

class TenantContextStorage {
  private static als = new AsyncLocalStorage<TenantContext>();

  static run<T>(tenantContext: TenantContext, fn: () => T): T {
    return TenantContextStorage.als.run(tenantContext, fn);
  }

  static get(): TenantContext | undefined {
    return TenantContextStorage.als.getStore();
  }
}
```

**Key Features**:
- No need to manually pass tenant context through function parameters
- Works across async operations
- Type-safe access to tenant information

### 2. TenantContextMiddleware

**Purpose**: Extract tenant information from incoming HTTP requests and set up AsyncLocalStorage context.

**Expected Headers**:
- `x-business-unit` or `businessUnit`
- `x-country-code` or `countryCode`

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/customs \
  -H "x-business-unit: serhafen" \
  -H "x-country-code: us"
```

**Middleware Flow**:
1. Extract tenant headers from request
2. Validate tenant information
3. Store in AsyncLocalStorage
4. Attach to request object for later access
5. Continue with request processing

### 3. DatasourceManager

**Purpose**: Dynamically manage database connections for multiple tenants.

**Key Responsibilities**:
- Create and cache database connections per tenant
- Support multiple database hosts (e.g., one per business unit)
- Automatic schema switching based on country code
- Connection pooling and resource management

**Database Configuration**:
```typescript
// src/config/database.config.ts
export default registerAs('database', () => ({
  databases: {
    'serhafen-us': {
      host: process.env.DB_HOST_SERHAFEN_US ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_DATABASE ?? 'serhafen_us',
      schema: 'us', // Country-specific schema
    },
    'serhafen-de': {
      host: process.env.DB_HOST_SERHAFEN_DE ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_DATABASE ?? 'serhafen_de',
      schema: 'de',
    },
  },
}));
```

**Usage**:
```typescript
const dataSource = await datasourceManager.getDataSource(
  'serhafen',
  'us'
);
// Returns cached connection for serhafen-us tenant
```

### 4. Request-Scoped Services

**Pattern**: Services must be request-scoped to access tenant context.

**Example**:
```typescript
import { Injectable, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DatasourceManager } from '@shared';

@Injectable({ scope: Scope.REQUEST })
export class OrderService extends TransactionContext {
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly datasourceManager: DatasourceManager,
  ) {
    super();
  }

  @Transactional()
  async createOrder(data: CreateOrderDto): Promise<Order> {
    // Tenant context is automatically available
    // Correct database and schema automatically selected
    return await this.entityManager.save(Order, data);
  }
}
```

**Important Notes**:
- Service must have `scope: Scope.REQUEST`
- Must inject `REQUEST` token
- Must inject `DatasourceManager`
- Extend `TransactionContext` for transactional methods

## Database Schema Strategy

The system uses **schema-based isolation** within PostgreSQL:

```
Database: serhafen_us
├── Schema: us (Country-specific)
│   ├── orders
│   ├── customers
│   └── invoices
├── Schema: public (Shared)
│   └── migrations

Database: serhafen_de
├── Schema: de (Country-specific)
│   ├── orders
│   ├── customers
│   └── invoices
├── Schema: public (Shared)
│   └── migrations
```

**Advantages**:
- Strong isolation between tenants
- Can use database-level features (foreign keys, etc.)
- Easy backup/restore per tenant
- Flexible scaling options

## Transactional Decorator Integration

The `@Transactional` decorator automatically integrates with tenant context:

```typescript
@Injectable({ scope: Scope.REQUEST })
export class PaymentService extends TransactionContext {
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly datasourceManager: DatasourceManager,
  ) {
    super();
  }

  @Transactional()
  async processPayment(orderId: string): Promise<Payment> {
    // 1. Tenant context extracted from request headers
    // 2. Correct database connection obtained
    // 3. Schema set to tenant's country code
    // 4. Transaction started
    // 5. entityManager available with correct context
    
    const order = await this.entityManager.findOne(Order, { 
      where: { id: orderId } 
    });
    
    const payment = await this.entityManager.save(Payment, {
      orderId: order.id,
      amount: order.total,
    });
    
    // Transaction commits automatically if successful
    return payment;
  }
}
```

**What happens under the hood**:
1. Decorator extracts tenant from `request.tenantContext`
2. Gets database connection from DatasourceManager
3. Creates QueryRunner
4. Sets schema: `SET search_path TO ${countryCode}`
5. Starts transaction
6. Provides `entityManager` via `TransactionContext`
7. Commits or rolls back based on outcome

## SNS/SQS Integration

Tenant context is automatically propagated to SNS messages as message attributes:

```typescript
@Injectable({ scope: Scope.REQUEST })
export class OrderService {
  constructor(
    @SnsPublisherClient('order-events')
    private readonly publisher: ISnsPublisher,
  ) {}

  async createOrder(data: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(data);
    
    // Tenant context automatically included as message attributes
    await this.publisher.publish(
      { 
        type: 'OrderCreated', 
        orderId: order.id,
        timestamp: new Date().toISOString(),
      },
      { domain: 'orders' },
    );
    
    return order;
  }
}
```

**SNS Message Attributes**:
```json
{
  "MessageAttributes": {
    "businessUnit": {
      "DataType": "String",
      "StringValue": "serhafen"
    },
    "countryCode": {
      "DataType": "String",
      "StringValue": "us"
    },
    "domain": {
      "DataType": "String",
      "StringValue": "orders"
    }
  }
}
```

## Migration Management

Migrations are run automatically on all tenant databases during application startup:

**Migration Service**:
```typescript
@Injectable()
export class MigrationService {
  async runMigrationsOnAllTenantDatabases(): Promise<void> {
    const tenants = await this.getAllTenants();
    
    for (const tenant of tenants) {
      const dataSource = await this.datasourceManager.getDataSource(
        tenant.businessUnit,
        tenant.countryCode
      );
      
      await dataSource.runMigrations({
        transaction: 'all', // Run all migrations in a single transaction
      });
      
      this.logger.log(
        `Migrations completed for ${tenant.businessUnit}-${tenant.countryCode}`
      );
    }
  }
}
```

**Bootstrap Integration**:
```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const migrationService = app.get(MigrationService);
  await migrationService.runMigrationsOnAllTenantDatabases();
  
  await app.listen(3000);
}
```

## Testing with Multi-Tenancy

### Unit Tests

Mock the tenant context in tests:

```typescript
describe('OrderService', () => {
  let service: OrderService;
  let datasourceManager: DatasourceManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: REQUEST,
          useValue: {
            tenantContext: {
              businessUnit: 'serhafen',
              countryCode: 'us',
            },
          },
        },
        {
          provide: DatasourceManager,
          useValue: {
            getDataSource: jest.fn().mockResolvedValue(mockDataSource),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should create order with tenant context', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Set tenant headers in E2E tests:

```typescript
describe('Orders API (e2e)', () => {
  it('/orders (POST)', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('x-business-unit', 'serhafen')
      .set('x-country-code', 'us')
      .send({ customerId: '123', items: [] })
      .expect(201);
  });
});
```

## Best Practices

### 1. Always Use Request Scope

```typescript
// ✅ Correct
@Injectable({ scope: Scope.REQUEST })
export class MyService extends TransactionContext {
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly datasourceManager: DatasourceManager,
  ) {
    super();
  }
}

// ❌ Incorrect - Won't have access to tenant context
@Injectable()
export class MyService {
  // ...
}
```

### 2. Always Extend TransactionContext

```typescript
// ✅ Correct - Can use @Transactional
export class MyService extends TransactionContext {
  @Transactional()
  async myMethod() {
    // this.entityManager is available
  }
}

// ❌ Incorrect - No access to entityManager
export class MyService {
  @Transactional()
  async myMethod() {
    // this.entityManager is undefined
  }
}
```

### 3. Validate Tenant Headers

Always ensure tenant headers are present:

```typescript
if (!request.tenantContext) {
  throw new BadRequestException(
    'Missing tenant headers: x-business-unit and x-country-code'
  );
}
```

### 4. Use TypeORM Entity Manager

Always use `this.entityManager` in transactional methods:

```typescript
// ✅ Correct - Uses transactional entity manager
@Transactional()
async createOrder(data: CreateOrderDto): Promise<Order> {
  return await this.entityManager.save(Order, data);
}

// ❌ Incorrect - Bypasses transaction
@Transactional()
async createOrder(data: CreateOrderDto): Promise<Order> {
  return await this.orderRepository.save(data);
}
```

### 5. Consider Tenant Isolation in Queries

Always ensure queries are tenant-aware:

```typescript
// ✅ Correct - Automatically scoped to tenant schema
@Transactional()
async findOrders(): Promise<Order[]> {
  return await this.entityManager.find(Order);
  // Query runs in correct tenant schema
}

// ⚠️ Be careful with raw queries
@Transactional()
async findOrdersRaw(): Promise<Order[]> {
  // Ensure schema is correct
  return await this.entityManager.query(
    'SELECT * FROM orders'
  );
}
```

## Troubleshooting

### Issue: "Missing tenant context for transactional operation"

**Cause**: Service not using request scope or tenant headers not provided.

**Solution**:
1. Ensure service has `scope: Scope.REQUEST`
2. Inject `REQUEST` and `DatasourceManager`
3. Provide tenant headers in requests

### Issue: "DatasourceManager not found on service instance"

**Cause**: DatasourceManager not injected or service doesn't extend TransactionContext.

**Solution**:
```typescript
constructor(
  @Inject(REQUEST) private readonly request: TenantRequest,
  private readonly datasourceManager: DatasourceManager, // Add this
) {
  super();
}
```

### Issue: Data appearing in wrong tenant

**Cause**: Schema not set correctly or using wrong connection.

**Solution**:
- Always use `@Transactional` decorator
- Verify schema in database logs: `SET search_path TO <schema>`
- Check tenant headers are correct

## Performance Considerations

### Connection Pooling

- DatasourceManager caches connections per tenant
- Each tenant gets its own connection pool
- Configure pool size in database config:

```typescript
{
  'serhafen-us': {
    // ...
    poolSize: 20,
    maxConnections: 50,
  }
}
```

### Memory Usage

- Request-scoped services are created per request
- Keep service constructors lightweight
- Use singleton services for non-tenant-specific logic

### Scaling Strategies

1. **Vertical**: Increase resources for database host
2. **Horizontal**: Separate tenant databases across multiple hosts
3. **Sharding**: Group tenants by business unit or region

## Related Documentation

- [Transaction Management](transaction.md)
- [Configuration System](configuration.md)
- [Best Practices](practices.md)

## References

- [AsyncLocalStorage Documentation](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [PostgreSQL Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [NestJS Request Scope](https://docs.nestjs.com/fundamentals/injection-scopes#request-provider)
