# Guidelines of Best TypeScript & NestJS Practices

This document outlines the architectural patterns and best practices implemented in this project. Each pattern includes explanations, code examples, and references to relevant documentation.

## Table of Contents
- [Configuration & Dependency Injection](#configuration--dependency-injection)
- [Architecture Patterns](#architecture-patterns)
- [Multi-Tenancy & Data Access](#multi-tenancy--data-access)
- [External Communication](#external-communication)
- [Error Handling & Validation](#error-handling--validation)
- [Testing Practices](#testing-practices)
- [Additional Patterns](#additional-patterns)

---

## Configuration & Dependency Injection

### 1. Configuration System (✅ Implemented)

**Pattern**: Spring Boot-inspired configuration with environment-specific overrides.

**Implementation**: See [configuration.md](configuration.md) for full details.

```typescript
// Base config: src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
}));

// Environment override: src/config/environments/production/database.config.ts
export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'prod-db.company.com',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  ssl: true,
  maxConnections: 50,
}));
```

**Usage in Services**:
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    const dbHost = this.configService.get<string>('database.host');
    const appName = this.configService.get<string>('app.meta.name');
  }
}
```

**Loading configs**: Use `loadEnvConfig()` in `SharedModule`:
```typescript
ConfigModule.forRoot({
  load: [
    loadEnvConfig('database'),
    loadEnvConfig('logging'),
    loadEnvConfig('app'),
  ],
  isGlobal: true,
}),
```

### 2. Factory Providers for Complex Dependencies (✅ Implemented)

**Pattern**: Use factory functions to create complex provider instances with dependencies.

**Example**: Circuit Breaker HTTP Client
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/clients/sample/sampleClientModule.ts start=27
{
  provide: SAMPLE_HTTP_CLIENT,
  useFactory: (
    httpService: HttpService,
    configService: ConfigService,
  ): ICircuitHttpClient => {
    const logger = new Logger('SampleHttpClientCircuitBreaker');
    const breakerOptions = {
      timeout: configService.get<number>('clients.sample.circuitBreaker.timeout') ?? 10000,
      errorThresholdPercentage: configService.get<number>('clients.sample.circuitBreaker.errorThresholdPercentage') ?? 50,
      resetTimeout: configService.get<number>('clients.sample.circuitBreaker.resetTimeout') ?? 30000,
    };
    return createCircuitBreakerClient(httpService, breakerOptions, logger);
  },
  inject: [HttpService, ConfigService],
}
```

**Example**: SNS Publisher Factory
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/sns/sns.module.ts start=7
const SnsPublisherFactoryProvider = {
  provide: SnsPublisherFactory,
  useFactory: (clientProvider: SnsClientProvider): SnsPublisherFactory => {
    const client = clientProvider.getClient();
    return new SnsPublisherFactory(client);
  },
  inject: [SnsClientProvider],
};
```

### 3. Interface-based Dependency Injection (✅ Implemented)

**Pattern**: Depend on interfaces instead of concrete implementations for testability and flexibility.

**Example**: HTTP Client Interface
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/http/circuit.http.ts start=1
export interface ICircuitHttpClient {
  get<T>(url: string): Promise<T>;
  post<T, R>(url: string, data?: R): Promise<T>;
}
```

**Usage in Client**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/clients/sample/sample.client.ts start=7
@Injectable()
export class SampleClient {
  private readonly logger = new Logger('SampleClient');

  constructor(
    @Inject(SAMPLE_HTTP_CLIENT)
    private readonly httpClient: ICircuitHttpClient,
  ) {}

  async getOk(): Promise<string> {
    return await this.httpClient.get<string>('/ok');
  }
}
```

**Benefits**:
- Easy to mock in tests
- Can swap implementations without changing client code
- Clear contract between components

### 4. Custom Decorators for Common Patterns (✅ Implemented)

**Pattern**: Create custom decorators to reduce boilerplate and enforce conventions.

**Example 1**: `@SnsPublisherClient` Decorator
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/sns/sns.decorators.ts start=5
export function SnsPublisherClient(topicArnOrName: string): ParameterDecorator {
  return Inject(snsPublisherToken(topicArnOrName));
}
```

**Usage**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/customs/query/query.service.ts start=16
@Injectable({ scope: Scope.REQUEST })
export class QueryService extends TransactionContext {
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly datasourceManager: DatasourceManager,
    @SnsPublisherClient('test-custom-events')
    private readonly customsPublisher: ISnsPublisher,
  ) {
    super();
  }
}
```

**Example 2**: `@Transactional` Decorator
See [transaction.md](transaction.md) for comprehensive documentation.

```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/customs/query/query.service.ts start=45
@Transactional()
private async findAllInTransaction(): Promise<string[]> {
  const messages = await this.entityManager
    .createQueryBuilder(Message, 'm')
    .select('m.message')
    .getRawMany();
  return messages.map((row: { m_message: string }) => row.m_message);
}
```

### 5. Provider Tokens as Symbols/Strings (✅ Implemented)

**Pattern**: Use Symbols or unique strings as injection tokens to avoid naming collisions.

**Example**: Client Tokens
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/clients/clients.token.ts start=1
export const SAMPLE_HTTP_CLIENT = Symbol('SAMPLE_HTTP_CLIENT');
```

**Example**: Dynamic SNS Publisher Tokens
```typescript path=null start=null
// src/shared/sns/sns.tokens.ts
export const snsPublisherToken = (topicArnOrName: string) => 
  `SNS_PUBLISHER_${topicArnOrName}`;
```

**Benefits**:
- Prevents token collision
- Type-safe injection
- Clear semantic meaning

---

## Architecture Patterns

### 6. Command/Query Separation (🔄 Partial)

**Pattern**: Separate read operations (queries) from write operations (commands).

**Current Implementation**: The codebase uses a service-based architecture. For stricter CQRS, consider:

```typescript path=null start=null
// Command
export class CreateOrderCommand {
  constructor(
    public readonly customerId: string,
    public readonly items: OrderItem[],
  ) {}
}

// Command Handler
@Injectable()
export class CreateOrderHandler {
  @Transactional()
  async execute(command: CreateOrderCommand): Promise<Order> {
    // Write operation
  }
}

// Query
export class GetOrderQuery {
  constructor(public readonly orderId: string) {}
}

// Query Handler
@Injectable()
export class GetOrderHandler {
  async execute(query: GetOrderQuery): Promise<OrderDto> {
    // Read operation
  }
}
```

### 7. Value Objects for Immutable Data (📋 Recommended)

**Pattern**: Use immutable value objects for domain concepts.

```typescript path=null start=null
export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.isValid(email)) {
      throw new Error('Invalid email format');
    }
    this.value = email;
  }

  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  toString(): string {
    return this.value;
  }
}

export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {
    Object.freeze(this);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

### 8. Aggregates for Root Entities (📋 Recommended)

**Pattern**: Group related entities under an aggregate root that enforces invariants.

```typescript path=null start=null
// Aggregate Root
export class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;

  addItem(item: OrderItem): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot add items to non-pending order');
    }
    this.items.push(item);
  }

  complete(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot complete order with no items');
    }
    this.status = OrderStatus.COMPLETED;
  }

  getTotalAmount(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.price),
      new Money(0, 'USD')
    );
  }
}
```

### 9. Result/Either Pattern (📋 Recommended)

**Pattern**: Return explicit success/failure results instead of throwing exceptions.

```typescript path=null start=null
export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  constructor(public readonly value: T) {}
  isSuccess(): this is Success<T> { return true; }
  isFailure(): this is Failure<never> { return false; }
}

export class Failure<E> {
  constructor(public readonly error: E) {}
  isSuccess(): this is Success<never> { return false; }
  isFailure(): this is Failure<E> { return true; }
}

// Usage
async function processPayment(orderId: string): Promise<Result<Payment, PaymentError>> {
  try {
    const payment = await this.paymentGateway.charge(orderId);
    return new Success(payment);
  } catch (error) {
    return new Failure(new PaymentError('Payment processing failed', error));
  }
}

// Consumer
const result = await processPayment('order-123');
if (result.isSuccess()) {
  console.log('Payment successful:', result.value);
} else {
  console.error('Payment failed:', result.error);
}
```

---

## Error Handling & Validation

### 10. Custom Exception Filters (✅ Implemented)

**Pattern**: Centralized error handling with custom exception filters.

**Implementation**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/filters/custom.exception.filter.ts start=10
export class CustomExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomExceptionFilter.name);
  
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request: any = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    
    this.logger.error(
      `Exception occurred at ${request.method} ${request.url}`,
      (exception as Error).stack,
    );

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message: string }).message;
      code = exception.constructor.name;
    }
    
    const errorResponse = {
      status: 'error',
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(process.env.NODE_ENV === 'local' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    response.status(status).send(errorResponse);
  }
}
```

**Register globally** in `main.ts`:
```typescript path=null start=null
app.useGlobalFilters(new CustomExceptionFilter());
```

### 11. Validation Pipes for Input Validation (📋 Recommended)

**Pattern**: Use class-validator and ValidationPipe for automatic DTO validation.

```typescript path=null start=null
// DTO with validation
import { IsString, IsEmail, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @Min(18)
  @Max(120)
  age: number;
}

// Controller
@Post('users')
async createUser(@Body() createUserDto: CreateUserDto) {
  return this.userService.create(createUserDto);
}

// Global setup in main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

### 12. Type-Safe Error Handling (🔄 Partial)

**Pattern**: Use TypeScript's type system to ensure exhaustive error handling.

```typescript path=null start=null
export enum PaymentErrorType {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_CARD = 'INVALID_CARD',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class PaymentError extends Error {
  constructor(
    public readonly type: PaymentErrorType,
    message: string,
  ) {
    super(message);
  }
}

// Type-safe error handler
function handlePaymentError(error: PaymentError): string {
  switch (error.type) {
    case PaymentErrorType.INSUFFICIENT_FUNDS:
      return 'Insufficient funds';
    case PaymentErrorType.INVALID_CARD:
      return 'Invalid card details';
    case PaymentErrorType.NETWORK_ERROR:
      return 'Network error, please try again';
    default:
      const _exhaustive: never = error.type; // TypeScript ensures all cases handled
      return 'Unknown error';
  }
}
```

---

## Multi-Tenancy & Data Access

### 13. Multi-Tenancy Support By Design (✅ Implemented)

**Pattern**: Automatic tenant context extraction and database routing.

**Key Components**:
1. **TenantContextStorage**: AsyncLocalStorage for tenant context propagation
2. **DatasourceManager**: Dynamic per-tenant database connections
3. **TenantContextMiddleware**: Extracts tenant from headers

**Implementation**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/kernel/tenant/tenant-context.storage.ts start=5
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

**Usage**: Tenant context is automatically available throughout request lifecycle:
```typescript path=null start=null
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
    // Tenant context automatically applied to database operations
    // Correct schema and connection automatically selected
    return await this.entityManager.save(Order, data);
  }
}
```

**Required Headers**:
- `x-business-unit` (or `businessUnit`)
- `x-country-code` (or `countryCode`)

### 14. Declarative Transactions with Unit of Work Pattern (✅ Implemented)

**Pattern**: Declarative transaction management with `@Transactional` decorator.

**Full documentation**: [transaction.md](transaction.md)

**Key Features**:
- Propagation levels (REQUIRED, REQUIRES_NEW)
- Isolation levels (READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE)
- Automatic tenant context integration
- Nested transaction support

**Example**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/customs/query/query.service.ts start=45
@Transactional()
private async findAllInTransaction(): Promise<string[]> {
  const messages = await this.entityManager
    .createQueryBuilder(Message, 'm')
    .select('m.message')
    .getRawMany();
  const _ = await this.findAllInSameTransaction();
  return messages.map((row: { m_message: string }) => row.m_message);
}

@Transactional({ propagation: Propagation.REQUIRES_NEW })
private async findOneInDifferentTransaction(id: number): Promise<string> {
  // Runs in separate transaction
  const message = await this.entityManager
    .query('SELECT * FROM messages WHERE id = $1', [id])
    .then((res: Message[]) => res[0]);
  return message.message;
}
```

### 15. Entity vs. DTO Separation (📋 Recommended)

**Pattern**: Separate domain entities from data transfer objects.

**Entity Example**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/customs/query/message.entity.ts start=3
@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', name: 'message' })
  message: string;
}
```

**DTO Example**:
```typescript path=null start=null
// Input DTO
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

// Output DTO
export class MessageResponseDto {
  id: number;
  message: string;
  createdAt: Date;

  static fromEntity(entity: Message): MessageResponseDto {
    return {
      id: entity.id,
      message: entity.message,
      createdAt: entity.createdAt,
    };
  }
}
```

### 16. Specification Pattern for Complex Queries (📋 Recommended)

**Pattern**: Encapsulate query logic in reusable specification objects.

```typescript path=null start=null
export interface Specification<T> {
  toQuery(qb: SelectQueryBuilder<T>): SelectQueryBuilder<T>;
}

export class ActiveOrdersSpec implements Specification<Order> {
  toQuery(qb: SelectQueryBuilder<Order>): SelectQueryBuilder<Order> {
    return qb.where('order.status = :status', { status: 'ACTIVE' });
  }
}

export class OrdersByCustomerSpec implements Specification<Order> {
  constructor(private customerId: string) {}

  toQuery(qb: SelectQueryBuilder<Order>): SelectQueryBuilder<Order> {
    return qb.where('order.customerId = :customerId', { 
      customerId: this.customerId 
    });
  }
}

// Combine specifications
export class AndSpecification<T> implements Specification<T> {
  constructor(private specs: Specification<T>[]) {}

  toQuery(qb: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
    return this.specs.reduce((query, spec) => spec.toQuery(query), qb);
  }
}

// Usage
const spec = new AndSpecification([
  new ActiveOrdersSpec(),
  new OrdersByCustomerSpec('customer-123'),
]);

const query = this.entityManager.createQueryBuilder(Order, 'order');
const orders = await spec.toQuery(query).getMany();
```

---

## External Communication

### 17. Circuit Breaker Pattern for HTTP Clients (✅ Implemented)

**Pattern**: Resilient HTTP communication with automatic circuit breaking.

**Full documentation**: [downstream-client.md](downstream-client.md)

**Factory Implementation**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/http/circuit.factory.ts start=52
export const createCircuitBreakerClient = (
  httpService: HttpService,
  breakerOptions: CircuitBreaker.Options,
  logger: Logger,
): ICircuitHttpClient => {
  const protectedRequest = async <T = unknown>(
    method: 'get' | 'post',
    url: string,
    data?: unknown,
  ): Promise<AxiosResponse<T>> => {
    if (method === 'get') {
      return firstValueFrom(httpService.get<T>(url));
    } else if (method === 'post') {
      return firstValueFrom(httpService.post<T>(url, data));
    }
    throw new Error(`Unsupported HTTP method: ${method}`);
  };

  const circuit = new CircuitBreaker(protectedRequest, breakerOptions);
  registerCircuitListeners(circuit, logger, breakerOptions);

  return {
    async get<T>(url: string, config?: unknown): Promise<T> {
      const response = await circuit.fire('get', url, undefined, config) as AxiosResponse<T>;
      return response.data;
    },
    async post<T, R>(url: string, data?: R): Promise<T> {
      const response = await circuit.fire('post', url, data) as AxiosResponse<T>;
      return response.data;
    },
  };
};
```

### 18. Distributed Tracing with OpenTelemetry (✅ Implemented)

**Pattern**: Automatic trace propagation across service boundaries.

**Full documentation**: [opentelemetry.md](opentelemetry.md)

**Key Features**:
- Automatic `traceparent` header injection
- Request/response tracing
- Integration with circuit breaker clients

**Enable tracing**:
```bash
# Development
NODE_OPTIONS='--require ts-node/register --require ./src/otel.bootstrap.ts' yarn start:dev

# Production
node --require ./dist/otel.bootstrap.js dist/main.js
```

### 19. Declarative SNS/SQS with Custom Decorators (✅ Implemented)

**Pattern**: Type-safe SNS/SQS integration with custom decorators.

**SNS Publisher Registration**:
```typescript path=/Users/ganesanarunachalam/Andino/Code/serhafan/catalyst-nest/src/shared/sns/snsTopicsModule.ts start=7
export class SnsTopicsModule {
  static registerTopics(topics: string[]): DynamicModule {
    const topicProviders = topics.map((t) => ({
      provide: snsPublisherToken(t),
      useFactory: (factory: SnsPublisherFactory) => factory.forTopic(t),
      inject: [SnsPublisherFactory],
    }));
    return {
      module: SnsTopicsModule,
      imports: [SnsModule],
      providers: [...topicProviders],
      exports: [...topicProviders],
    };
  }
}
```

**Usage**:
```typescript path=null start=null
@Module({
  imports: [
    SnsTopicsModule.registerTopics([
      'test-custom-events',
      'order-events',
    ]),
  ],
})
export class CustomsModule {}

// In service
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
      { type: 'OrderCreated', orderId: order.id },
      { domain: 'orders' },
    );
    
    return order;
  }
}
```

---

## Modular Architecture

### 20. Feature-based Module Structure (✅ Implemented)

**Pattern**: Organize code by feature/domain rather than technical layer.

**Current Structure**:
```
src/
├── customs/           # Customs domain
│   ├── query/
│   │   ├── query.controller.ts
│   │   ├── query.service.ts
│   │   └── message.entity.ts
│   └── customs.module.ts
├── demo/              # Demo features
├── actuator/          # Health checks
├── clients/           # External service clients
│   └── sample/
│       ├── sample.client.ts
│       └── sampleClientModule.ts
└── shared/            # Shared kernel
    ├── database/
    ├── http/
    ├── sns/
    ├── transaction/
    └── shared.module.ts
```

**Best Practices**:
- Each feature module is self-contained
- Shared logic in `shared/` module
- Clear boundaries between domains
- Minimal coupling between features

### 21. Shared Kernel for Common Types and Logic (✅ Implemented)

**Pattern**: Centralize shared infrastructure and domain logic.

**Shared Module Structure**:
```
shared/
├── config/           # Configuration loader
├── database/         # Multi-tenant database management
├── filters/          # Exception filters
├── http/             # Circuit breaker HTTP client
├── kernel/           # Core abstractions
│   └── tenant/       # Tenant context management
├── sns/              # SNS integration
├── sqs/              # SQS integration
└── transaction/      # Transaction management
```

**Export pattern**:
```typescript path=null start=null
// src/shared/index.ts
export * from './database/datasource.manager';
export * from './transaction/transactional-method.decorator';
export * from './kernel/tenant/tenant-context';
export * from './http/circuit.http';
// ... etc
```

### 22. Modular Architecture with Lazy Loading (🔄 Partial)

**Pattern**: Load feature modules dynamically to reduce startup time.

```typescript path=null start=null
@Module({
  imports: [
    RouterModule.register([
      {
        path: 'admin',
        module: AdminModule,
      },
    ]),
  ],
})
export class AppModule {}

// Lazy load in route
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
  },
];
```

---

## Testing Practices

### 23. Dependency Injection in Tests (🔄 Partial)

**Pattern**: Use TestingModule for proper dependency injection in tests.

```typescript path=null start=null
import { Test, TestingModule } from '@nestjs/testing';

describe('OrderService', () => {
  let service: OrderService;
  let repository: Repository<Order>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    repository = module.get<Repository<Order>>(getRepositoryToken(Order));
  });

  it('should create an order', async () => {
    const orderData = { customerId: '123', items: [] };
    jest.spyOn(repository, 'save').mockResolvedValue(orderData as Order);
    
    const result = await service.createOrder(orderData);
    
    expect(repository.save).toHaveBeenCalledWith(orderData);
    expect(result).toEqual(orderData);
  });
});
```

### 24. Test Builders/Object Mother (📋 Recommended)

**Pattern**: Create test data builders for complex objects.

```typescript path=null start=null
// Object Mother pattern
export class OrderMother {
  static pending(): Order {
    return {
      id: '123',
      status: OrderStatus.PENDING,
      items: [],
      total: 0,
    };
  }

  static completed(): Order {
    return {
      ...this.pending(),
      status: OrderStatus.COMPLETED,
      completedAt: new Date(),
    };
  }

  static withItems(items: OrderItem[]): Order {
    return {
      ...this.pending(),
      items,
      total: items.reduce((sum, item) => sum + item.price, 0),
    };
  }
}

// Builder pattern
export class OrderBuilder {
  private order: Partial<Order> = {
    status: OrderStatus.PENDING,
    items: [],
  };

  withId(id: string): this {
    this.order.id = id;
    return this;
  }

  withStatus(status: OrderStatus): this {
    this.order.status = status;
    return this;
  }

  withItems(items: OrderItem[]): this {
    this.order.items = items;
    return this;
  }

  build(): Order {
    return this.order as Order;
  }
}

// Usage in tests
const order = new OrderBuilder()
  .withId('123')
  .withStatus(OrderStatus.PENDING)
  .withItems([{ id: '1', price: 100 }])
  .build();

const pendingOrder = OrderMother.pending();
```

### 25. Integration Testing with TestContainers (📋 Recommended)

**Pattern**: Use real database instances in integration tests.

```typescript path=null start=null
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('OrderService Integration', () => {
  let container: StartedTestContainer;
  let module: TestingModule;
  let service: OrderService;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15')
      .withEnvironment({ POSTGRES_PASSWORD: 'test' })
      .withExposedPorts(5432)
      .start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getMappedPort(5432),
          username: 'postgres',
          password: 'test',
          database: 'test',
          entities: [Order],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Order]),
      ],
      providers: [OrderService],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  afterAll(async () => {
    await container.stop();
    await module.close();
  });

  it('should persist order to database', async () => {
    const order = await service.createOrder({ customerId: '123' });
    expect(order.id).toBeDefined();
    
    const found = await service.findById(order.id);
    expect(found).toEqual(order);
  });
});
```

### 26. Test Architecture Rules (ArchUnit) (📋 Recommended)

**Pattern**: Enforce architectural rules in tests.

```typescript path=null start=null
import { ArchRule, fromClasses, noClasses } from 'ts-arch';

describe('Architecture Rules', () => {
  it('Controllers should not depend on repositories directly', () => {
    const rule = noClasses()
      .that()
      .resideInAPackage('**/controllers/**')
      .should()
      .dependOnClassesThat()
      .resideInAPackage('**/repositories/**');

    expect(() => rule.check()).not.toThrow();
  });

  it('Services should be in the correct layer', () => {
    const rule = fromClasses('**/services/**/*Service.ts')
      .should()
      .beSuffixedWith('Service');

    expect(() => rule.check()).not.toThrow();
  });

  it('Entities should not depend on DTOs', () => {
    const rule = noClasses()
      .that()
      .resideInAPackage('**/entities/**')
      .should()
      .dependOnClassesThat()
      .resideInAPackage('**/dto/**');

    expect(() => rule.check()).not.toThrow();
  });
});
```

---

## Additional Patterns

### 27. Connection Pooling and Resource Management (✅ Implemented)

**Pattern**: Efficient database connection management.

**Implementation**: TypeORM manages connection pooling automatically. Configure in database config:
```typescript path=null start=null
export default registerAs('database', () => ({
  databases: {
    'tenant-1': {
      host: 'localhost',
      port: 5432,
      maxConnections: 20,        // Max pool size
      idleTimeoutMillis: 30000,  // Close idle connections
      connectionTimeoutMillis: 2000,
    },
  },
}));
```

### 28. Caching Abstractions (📋 Recommended)

**Pattern**: Declarative caching with decorators.

```typescript path=null start=null
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class ProductService {
  @CacheKey('all_products')
  @CacheTTL(300) // 5 minutes
  async findAll(): Promise<Product[]> {
    return this.productRepo.find();
  }

  @CacheKey((args) => `product_${args[0]}`)
  @CacheTTL(600) // 10 minutes
  async findOne(id: string): Promise<Product> {
    return this.productRepo.findOne(id);
  }
}

// Module setup
@Module({
  imports: [
    CacheModule.register({
      ttl: 300,
      max: 100,
      store: redisStore,
      host: 'localhost',
      port: 6379,
    }),
  ],
})
export class ProductModule {}
```

### 29. State Machines for Complex Workflows (📋 Recommended)

**Pattern**: Explicit state transitions with validation.

```typescript path=null start=null
export enum OrderState {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum OrderEvent {
  CONFIRM = 'CONFIRM',
  SHIP = 'SHIP',
  DELIVER = 'DELIVER',
  CANCEL = 'CANCEL',
}

export class OrderStateMachine {
  private static transitions: Record<OrderState, Partial<Record<OrderEvent, OrderState>>> = {
    [OrderState.PENDING]: {
      [OrderEvent.CONFIRM]: OrderState.CONFIRMED,
      [OrderEvent.CANCEL]: OrderState.CANCELLED,
    },
    [OrderState.CONFIRMED]: {
      [OrderEvent.SHIP]: OrderState.SHIPPED,
      [OrderEvent.CANCEL]: OrderState.CANCELLED,
    },
    [OrderState.SHIPPED]: {
      [OrderEvent.DELIVER]: OrderState.DELIVERED,
    },
    [OrderState.DELIVERED]: {},
    [OrderState.CANCELLED]: {},
  };

  static transition(currentState: OrderState, event: OrderEvent): OrderState {
    const newState = this.transitions[currentState]?.[event];
    
    if (!newState) {
      throw new Error(
        `Invalid transition from ${currentState} with event ${event}`
      );
    }
    
    return newState;
  }

  static canTransition(currentState: OrderState, event: OrderEvent): boolean {
    return !!this.transitions[currentState]?.[event];
  }
}

// Usage
@Injectable()
export class OrderService {
  async confirmOrder(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    
    const newState = OrderStateMachine.transition(
      order.state,
      OrderEvent.CONFIRM
    );
    
    order.state = newState;
    return this.orderRepo.save(order);
  }
}
```

---

## Summary

### ✅ Implemented (14)
- Configuration System
- Factory Providers
- Interface-based DI
- Custom Decorators (@Transactional, @SnsPublisherClient)
- Provider Tokens as Symbols
- Custom Exception Filters
- Entity vs. DTO Separation
- Multi-Tenancy Support
- Declarative Transactions
- Feature-based Module Structure
- Shared Kernel
- Circuit Breaker Pattern
- Distributed Tracing (OpenTelemetry)
- SNS/SQS Declarative Integration

### 🔄 Partially Implemented (4)
- Command/Query Separation
- Type-Safe Error Handling
- Dependency Injection in Tests
- Lazy Loading

### 📋 Recommended for Implementation (11)
- Value Objects
- Aggregates
- Result/Either Pattern
- Validation Pipes
- Specification Pattern
- Test Builders/Object Mother
- Integration Testing with TestContainers
- Test Architecture Rules
- Caching Abstractions
- State Machines
- Advanced Resource Management

## Related Documentation
- [Configuration System](configuration.md)
- [Transaction Management](transaction.md)
- [Downstream Clients](downstream-client.md)
- [OpenTelemetry](opentelemetry.md)

## Contributing
When implementing new patterns:
1. Document with code examples
2. Add to this practices guide
3. Include tests demonstrating the pattern
4. Update related documentation files
