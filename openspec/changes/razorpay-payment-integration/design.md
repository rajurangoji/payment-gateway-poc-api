# Design: Razorpay Payment Integration (Backend)

## Stack

`nestjs` (Fastify adapter), contract-first OpenAPI generation, TypeORM raw-migration style (no
entity classes), PostgreSQL.

## API Contract

**Contract type: Both OpenAPI (REST) AND AsyncAPI (event)** — the story has 5 synchronous HTTP
endpoints and one published event (`ORDER_CREATED`, `Type: event` scenarios in spec.md).

### REST — `specs/payments.yml`

| Method | Path | operationId | Purpose |
|---|---|---|---|
| GET | `/api/products` | `listProducts` | List ACTIVE `cart_products` for the storefront |
| POST | `/api/checkout/create-order` | `createCheckoutOrder` | Create `orders`/`order_items`, create Razorpay order, publish `ORDER_CREATED` |
| POST | `/api/payments/razorpay/verify` | `verifyRazorpayPayment` | Server-side HMAC signature verification → CAPTURED/PAID |
| POST | `/api/webhooks/razorpay` | `handleRazorpayWebhook` | Idempotent webhook ingestion (signature-verified) |
| POST | `/api/orders/{id}/refund` | `refundOrder` | Razorpay Refunds API + `refunds` row |

Generated successfully via `npx openapi-generate --output ./generated` into
`generated/payments/payments.controller.base.ts` + `payments.dto.ts` (verified — see Assumptions
below for one generator quirk found while validating this).

### Event — `src/resources/asyncapis/payments.asyncapi.yml`

| Channel | Message | Publisher |
|---|---|---|
| `payments.order.created` | `ORDER_CREATED` | `createCheckoutOrder` use case, via `COMMON_SQS_CLIENT` (fire-and-forget; publish failure must not fail the HTTP response) |

## Data Model

No new tables — this story implements against the schema already migrated in
`src/migrations/1755000000000-CreateUsersTable.ts` through
`1755000008000-SeedDummyCartProducts.ts`:

`users → cart_products → orders → order_items`, `orders → payments (1:1) → payment_transactions
→ refunds`, and standalone `payment_events` (audit/idempotency log for webhooks).

## Architecture Placement

- New module: `src/payments/` (module, controller extending `PaymentsControllerBase`, services)
  — following the same pattern as `src/contract-first/flights.controller.ts` /
  `hawb.command.controller.ts`, registered in `ContractFirstModule` (`src/contract-first/module.ts`)
- Razorpay SDK client: a thin wrapper service (e.g. `RazorpayClientService`) wrapping the `razorpay`
  npm package, configured from `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` via `ConfigService` — mirrors
  the existing `clients.config.ts` / `src/clients/sample` pattern for external HTTP clients
- SQS publish: inject `COMMON_SQS_CLIENT` (from `AwsModule`) directly, following the
  `SqsClientProvider` convention in `src/shared/sqs` — there is no existing *producer* example in
  this codebase (only a consumer, `SampleSqsConsumer`), so this is the first one
- DB access: **correcting an earlier assumption** — TypeORM entity classes DO exist and are the
  established pattern (`src/customs/query/message.entity.ts`'s `Message` entity, used via
  `entityManager.createQueryBuilder(Message, 'm')` in `QueryService`). Schema stays fully owned by
  the migrations (`synchronize: false` in `datasource.manager.ts`) — entities are query-building
  conveniences only, not schema source of truth. Define one entity per payments table (`User`,
  `CartProduct`, `Order`, `OrderItem`, `Payment`, `PaymentTransaction`, `Refund`, `PaymentEvent`)
  matching the migrated columns exactly, and register them wherever `DatasourceManager`'s injected
  `entities` list is assembled.
- Transactions: **does not** use `@Transactional()`/`TransactionContext`/`DatasourceManager`. Those
  are all built around resolving a `DataSource` from `businessUnit`+`countryCode` (request headers
  or tenant context), and the engineer explicitly rejected any businessUnit/countryCode concept
  anywhere in the payments module — no header, no config, no hardcoded literal. See "Standalone
  payments DataSource" below.

### Standalone payments DataSource

Payments owns a completely independent, single TypeORM `DataSource`
(`PaymentsDataSourceProvider`, `src/payments/payments-datasource.provider.ts`), built directly from
the same `DB_BU1_US_*` env vars already used for the migrations, with the 8 payments entities
registered on it. It is lazily initialized once and cached (singleton), with **no** dependency on
`DatasourceManager`, `TenantContextMiddleware`, `TenantContextStorage`, or businessUnit/countryCode
anywhere:

```ts
@Injectable()
export class PaymentsDataSourceProvider {
  private dataSource?: DataSource;

  async getDataSource(): Promise<DataSource> {
    if (!this.dataSource) {
      this.dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_BU1_US_HOST,
        port: Number(process.env.DB_BU1_US_PORT),
        username: process.env.DB_BU1_US_USERNAME,
        password: process.env.DB_BU1_US_PASSWORD,
        database: process.env.DB_BU1_US_DATABASE,
        schema: process.env.DB_BU1_US_SCHEMA,
        entities: [User, CartProduct, Order, OrderItem, Payment, PaymentTransaction, Refund, PaymentEvent],
        synchronize: false,
      });
      await this.dataSource.initialize();
    }
    return this.dataSource;
  }
}
```

Payments services are regular singleton `@Injectable()` classes (not request-scoped), and use
TypeORM's own `dataSource.transaction(async (manager) => {...})` for atomicity instead of
`@Transactional()`. This is a deliberate, explicit deviation from the `QueryService` reference
pattern — justified because the engineer does not want the payments module entangled with this
codebase's multi-tenant DB routing at all.

## Integration Points

- **Razorpay Orders API** (`orders.create`) — called from `createCheckoutOrder`
- **Razorpay Refunds API** (`payments.refund`) — called from `refundOrder`
- **Razorpay webhooks** — inbound at `POST /api/webhooks/razorpay`; requires `RAZORPAY_WEBHOOK_SECRET`
  (currently blank in `.env` — must be filled in once a webhook is registered in the Razorpay
  dashboard; see manual checklist already given to the engineer)
- **SQS** — outbound `ORDER_CREATED` publish; requires a new queue registered via
  `OrderEventsQueueConfig` (see Assumptions)
- **Tenant routing — deliberately absent.** Per engineer decision, the payments API does not
  require `X-Business-Unit`/`X-Country-Code` from callers, and the payments module itself contains
  zero businessUnit/countryCode logic — no header, no config, no hardcoded literal. It connects to
  the database directly via its own standalone `DataSource` (see "Standalone payments DataSource"
  above), completely independent of this codebase's multi-tenant DB routing.

## Feature Flags / Observability

- No feature flag system exists in this codebase; none introduced by this story
- Logging: use the existing `nestjs-pino` logger (`PinoLogger`) — matches `MigrationService`'s
  pattern of injecting `@InjectPinoLogger`
- No new dashboards/alerts requested; webhook processing failures and Razorpay API failures should
  be logged at `error` level so they're visible in existing log aggregation

## Assumptions / Notes for `/gen-tasks` and `/gen-impl`

1. **Error response shape**: `specs/payments.yml`'s `ErrorResponse` schema matches what the actual
   global `CustomExceptionFilter` produces (`{status, code, message, timestamp, path, method,
   stack?}` — registered as `APP_FILTER` in `shared.module.ts`), **not** the older
   `{success, error: {code, message, details}}` wrapper documented in `specs/flights.yml` /
   `specs/hawb.command.yml`. Those two existing specs don't match current runtime behavior; this
   story follows what the code actually does rather than propagating that inconsistency further.
2. **Generator quirk (cosmetic, harmless)**: `npx openapi-generate` sometimes reuses the *success*
   response DTO type for a couple of `@ApiResponse` error-code decorators when a shared
   `$ref: '#/components/responses/...'` is used across operations (e.g.
   `createCheckoutOrder`'s 400/404/409/500/502 all typed as `CreateCheckoutOrderResponseDto` in the
   generated Swagger metadata, instead of `ErrorResponseDto`). This only affects the generated
   Swagger UI type badges — actual error handling is via thrown `HttpException`s, unaffected by
   this decorator metadata. Do not attempt to "fix" this by hand-editing `generated/` (it's
   regenerated on every build); if it matters later, revisit by not using a shared `$ref` for error
   responses.
3. **Multi-line YAML `description: |` fields break code generation** if they land inside a
   parameter or schema-property description (the generator emits the raw string — including
   embedded newlines — directly into a TS decorator string literal, which fails to compile).
   Operation-level and object-schema-level `description` fields are silently dropped by the
   generator (harmless), but **parameter and property descriptions must be single-line strings**.
   This was hit and fixed twice while authoring `payments.yml` (the `X-Business-Unit` parameter and
   `razorpayOrderId` property) — keep this in mind if `/gen-impl` or a later story edits this file.
4. **New SQS queue required**: add to `queues.config.ts`:
   ```ts
   orderEvents: { name: process.env.SQS_ORDER_EVENTS_QUEUE ?? 'order-events-queue' }
   ```
   and add `SQS_ORDER_EVENTS_QUEUE` to `.env`/`.env.example`. No consumer is implemented as part of
   this story — publishing is fire-and-forget.
5. **`docs/naming-conventions.md` does not exist** in this repo. The AsyncAPI channel name
   (`payments.order.created`) follows the generic `{domain}.{entity}.{event}` convention as a
   reasonable default; reconcile once that file is instantiated.
6. **No auth layer exists** (see spec.md Gaps) — all 5 endpoints are unauthenticated in this POC.
7. Razorpay SDK: use the official `razorpay` npm package (needs adding to `package.json`
   dependencies — not yet present).
8. **No tenant headers, no tenant concept anywhere in payments (engineer decision, final)**:
   removed `X-Business-Unit`/`X-Country-Code` from all operations in `specs/payments.yml`, and —
   after two rounds of clarification — confirmed the payments module must contain **zero**
   businessUnit/countryCode logic, not even a hardcoded literal or a config default. See
   "Standalone payments DataSource" under Architecture Placement above: payments gets its own
   independent `DataSource` (`PaymentsDataSourceProvider`) built directly from `DB_BU1_US_*` env
   vars, bypassing `DatasourceManager`/`@Transactional()`/`TransactionContext` entirely.
9. **`src/customs/query/` was read as the reference implementation** (per gen-tasks Step 2) for
   entity/query conventions (`Message` entity, `entityManager.createQueryBuilder(...)` style) — but
   its request-scoped, `@Transactional()`-based transaction handling is **not** followed, per
   Assumption 8. Payments services are plain singleton `@Injectable()` classes using
   `PaymentsDataSourceProvider.getDataSource()` + TypeORM's own `dataSource.transaction(...)` /
   `dataSource.getRepository(Entity)` for queries.
