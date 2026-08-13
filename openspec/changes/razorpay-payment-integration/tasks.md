# Tasks: Razorpay Payment Integration (Backend)

**Story ID:** razorpay-payment-integration
**Stack:** nestjs
**Spec:** openspec/changes/razorpay-payment-integration/specs/payments/spec.md
**Design:** openspec/changes/razorpay-payment-integration/design.md

**Scenario ID legend** (spec.md has no IDs; these are assigned here for traceability):
- Product Catalog Listing: P1 (happy), P2 (excludes non-active), P3 (empty catalog), P4 (no internal fields)
- Checkout Order Creation: C1 (happy), C2 (client amount ignored), C3 (unknown product), C4 (insufficient stock), C5 (empty items), C6 (invalid quantity), C7 (unknown user), C8 (Razorpay unavailable); Event: E1 (envelope), E2 (publish-failure isolation), E3 (duplicate on retry)
- Razorpay Payment Verification: V1 (happy), V2 (invalid signature), V3 (server-stored order id used), V4 (nonexistent order), V5 (duplicate verification), V6 (missing fields)
- Razorpay Webhook Handling: W1 (payment.captured), W2 (payment.failed), W3 (invalid signature), W4 (duplicate delivery), W5 (malformed payload), W6 (unmatched transaction), W7 (full envelope captured)
- Order Refund: R1 (happy), R2 (never paid), R3 (already refunded), R4 (not found), R5 (Razorpay failure)

**Note:** while reading the codebase for existing patterns (design.md's "Read `src/customs/query/`"
assumption), design.md was corrected twice during gen-impl — no API/contract change, only how the
implementation is wired:
1. TypeORM entity classes **do** exist as a pattern (`Message` in `message.entity.ts`) — this plan
   uses entities, not raw SQL, for the 8 payments tables.
2. **Final:** the payments module uses **no** businessUnit/countryCode concept anywhere (not a
   header, not a config default, not a hardcoded literal — engineer decision, confirmed after two
   rounds of clarification). It does **not** use `@Transactional()`/`TransactionContext`/
   `DatasourceManager` at all. Instead it owns a standalone `PaymentsDataSourceProvider`
   (`src/payments/payments-datasource.provider.ts`) — a plain TypeORM `DataSource` built directly
   from `DB_BU1_US_*` env vars — and every payments service below is a regular singleton
   `@Injectable()` using `dataSource.transaction(...)` for atomicity, **not**
   `@Injectable({scope: Scope.REQUEST})` extending `TransactionContext` as originally planned. See
   design.md "Standalone payments DataSource".

---

## Task Overview

| # | Task | Spec Scenarios |
|---|------|-----------------|
| 1 | Payments domain entities (`User`, `CartProduct`, `Order`, `OrderItem`, `Payment`, `PaymentTransaction`, `Refund`, `PaymentEvent`) | infra (supports all) |
| 2 | Payments configuration (`RazorpayConfig`, `PaymentsConfig`, SQS queue config, env vars) | infra (supports all) |
| 3 | `RazorpayClientService` — wraps `razorpay` SDK (`orders.create`, `payments.refund`) | infra (supports C1, C8, R1, R5) |
| 4 | Razorpay signature verification utilities (payment + webhook HMAC-SHA256) | infra (supports V1-V3, W1-W3) |
| 5 | `OrderEventsPublisher` — SQS producer for `ORDER_CREATED` | E1, E2, E3 |
| 6 | `ProductsService` + `listProducts` wiring | P1, P2, P3, P4 |
| 7 | `CheckoutService` — happy path: compute totals, persist, create Razorpay order, publish event | C1, C8, E1, E2, E3 |
| 8 | `CheckoutService` — validation & business-rule error paths | C2, C3, C4, C5, C6, C7 |
| 9 | `PaymentVerificationService` — `verifyRazorpayPayment` | V1, V2, V3, V4, V5, V6 |
| 10 | `WebhookService` — `handleRazorpayWebhook` | W1, W2, W3, W4, W5, W6, W7 |
| 11 | `RefundsService` — `refundOrder` | R1, R2, R3, R4, R5 |
| 12 | `PaymentsController` + `PaymentsModule` wiring | integration (all) |

---

- [x] 1. Payments domain entities

  **Spec scenarios:** infra (supports all)

  - [x] 1.1 RED — Write failing test: `src/payments/entities/payments-entities.spec.ts` — asserts,
    for each of the 8 entities, that TypeORM's metadata storage has the expected table name and
    column names (using `getMetadataArgsStorage()`), matching the columns created by
    `src/migrations/1755000000000-CreateUsersTable.ts` through
    `1755000007000-CreatePaymentEventsTable.ts` exactly (snake_case DB columns via `{name: '...'}`,
    camelCase TS properties)
  - [x] 1.2 GREEN — Create `src/payments/entities/user.entity.ts` — `User` entity mapping `users`
  - [x] 1.2 GREEN — Create `src/payments/entities/cart-product.entity.ts` — `CartProduct` entity mapping `cart_products`
  - [x] 1.2 GREEN — Create `src/payments/entities/order.entity.ts` — `Order` entity mapping `orders`
  - [x] 1.2 GREEN — Create `src/payments/entities/order-item.entity.ts` — `OrderItem` entity mapping `order_items`
  - [x] 1.2 GREEN — Create `src/payments/entities/payment.entity.ts` — `Payment` entity mapping `payments`
  - [x] 1.2 GREEN — Create `src/payments/entities/payment-transaction.entity.ts` — `PaymentTransaction` entity mapping `payment_transactions`
  - [x] 1.2 GREEN — Create `src/payments/entities/refund.entity.ts` — `Refund` entity mapping `refunds`
  - [x] 1.2 GREEN — Create `src/payments/entities/payment-event.entity.ts` — `PaymentEvent` entity mapping `payment_events`
  - [x] 1.3 GREEN — Modify `src/data.module.ts` — add all 8 new entities to the `DatasourceManager` constructor's entities array, alongside the existing `Message`
  - [x] 1.4 REFACTOR — Extract a barrel `src/payments/entities/index.ts` re-exporting all 8, to keep the `data.module.ts` import list short

- [x] 2. Payments configuration

  **Spec scenarios:** infra (supports all)

  **Correction found during gen-impl:** `src/config/*.config.ts` (`registerAs`-style —
  `clients.config.ts`, `queues.config.ts`, `database.config.ts`, `aws.config.ts`) are dead code —
  not wired into `ConfigModule.forRoot`'s `load`. The actually-consumed config path is
  `@snow-tzu/type-config-nestjs`'s class-based `@ConfigurationProperties()` (e.g.
  `SampleClientConfig`, `ExampleQueueConfig`), registered via `TypeConfigModule.forFeature([...])`
  in `src/config.module.ts`, sourced from `resources/application.yml` (profile overrides in
  `application-{development,staging}.yml`). Below reflects that reality instead of the original
  (incorrect) `registerAs` plan.

  **Second correction found during gen-impl:** the engineer explicitly rejected any
  businessUnit/countryCode concept in the payments module — no header, no config, no hardcoded
  literal, nothing. So `@Transactional()`/`TransactionContext`/`DatasourceManager` (all built around
  businessUnit+countryCode tenant routing) are **not used** by payments at all. Instead, payments
  gets its own standalone, independent TypeORM `DataSource` (`PaymentsDataSourceProvider`), built
  directly from the same `DB_BU1_US_*` env vars already used for migrations, owning the 8 payments
  entities. Payments services use TypeORM's own `dataSource.transaction(async (manager) => {...})`
  for atomicity instead of `@Transactional()`. `PaymentsConfig` (defaultBusinessUnit/
  defaultCountryCode) was created then deleted once this was clarified — removed from
  `config.module.ts` and `resources/application.yml`.

  - [x] 2.1 RED — Write failing test: `src/config/razorpay.config.spec.ts` — asserts `RazorpayConfig`
    binds `keyId`/`keySecret` from the `razorpay.keyId`/`razorpay.keySecret` config path (required)
    and `webhookSecret` from `razorpay.webhookSecret` (optional, may be undefined); a second test
    file `src/payments/payments-datasource.provider.spec.ts` asserts `PaymentsDataSourceProvider`
    builds a `DataSource` directly from `DB_BU1_US_*` env vars and lazily initializes it once
    (singleton)
  - [x] 2.2 GREEN — Create `src/config/razorpay.config.ts` — `@ConfigurationProperties('razorpay')` class (`keyId`, `keySecret` required; `webhookSecret` optional), following the `SampleClientConfig` pattern
  - [x] 2.3 GREEN — Create `src/payments/payments-datasource.provider.ts` — standalone `DataSource` built directly from `DB_BU1_US_*` env vars, entities = the 8 payments entities, lazily initialized and cached
  - [x] 2.4 GREEN — Create `src/payments/order-events-queue.config.ts` — `@ConfigurationProperties('queues.orderEvents')` class (`name`, required), following the `ExampleQueueConfig` pattern
  - [x] 2.5 GREEN — Modify `src/config.module.ts` — add `RazorpayConfig`, `OrderEventsQueueConfig` to `TypeConfigModule.forFeature([...])`
  - [x] 2.6 GREEN — Modify `resources/application.yml` — add `razorpay.keyId`/`keySecret`/`webhookSecret`, `queues.orderEvents.name`, all `${ENV_VAR:default}` interpolated
  - [x] 2.7 GREEN — Modify `.env` and `.env.example` — add `SQS_ORDER_EVENTS_QUEUE`
  - [x] 2.8 GREEN — Modify `package.json` — add `razorpay` as a dependency (via `yarn add`)
  - [x] 2.9 REFACTOR — none

- [x] 3. `RazorpayClientService`

  **Spec scenarios:** infra (supports C1, C8, R1, R5)

  **Bug found and fixed during gen-impl:** this repo's `tsconfig.json` has no `esModuleInterop`, so
  `import Razorpay from 'razorpay'` silently compiles to code expecting a `.default` export that
  the CJS `razorpay` package (`export = Razorpay`) doesn't have — `new Razorpay(...)` would have
  thrown `razorpay_1.default is not a constructor` at runtime, mock or not. Fixed by using
  `import Razorpay = require('razorpay')` instead. Caught because the RED/GREEN test was actually
  run, not just eyeballed.

  - [x] 3.1 RED — Write failing test: `src/payments/razorpay-client.service.spec.ts` — mocks the
    `razorpay` SDK constructor; asserts `createOrder(amountPaise, currency, receipt)` calls
    `instance.orders.create` with the right shape and returns `{id, amount, currency, status}`;
    asserts `createRefund(paymentId, amountPaise)` calls `instance.payments.refund`; asserts both
    methods propagate/wrap SDK errors as a recognizable exception type (`RazorpayApiError`)
  - [x] 3.2 GREEN — Create `src/payments/razorpay-client.service.ts` — thin wrapper around the
    `razorpay` npm package, constructed from `RazorpayConfig` (`key_id`/`key_secret`); also created
    `src/payments/razorpay-api.error.ts` (`RazorpayApiError`)
  - [x] 3.3 REFACTOR — none

- [x] 4. Razorpay signature verification utilities

  **Spec scenarios:** infra (supports V1, V2, V3, W1, W2, W3)

  - [x] 4.1 RED — Write failing test: `src/payments/razorpay-signature.util.spec.ts` — asserts
    `verifyPaymentSignature(orderId, paymentId, signature, secret)` returns `true` only when
    `signature === HMAC_SHA256(orderId + "|" + paymentId, secret)`; asserts
    `verifyWebhookSignature(rawBody, signature, secret)` returns `true` only when
    `signature === HMAC_SHA256(rawBody, secret)`; both return `false` (never throw) on mismatch,
    including a differing-length signature (which would otherwise make `crypto.timingSafeEqual`
    throw)
  - [x] 4.2 GREEN — Create `src/payments/razorpay-signature.util.ts` — pure functions, Node `crypto` HMAC-SHA256, constant-time comparison (`crypto.timingSafeEqual`) guarded by a length check
  - [x] 4.3 REFACTOR — none

- [x] 5. `OrderEventsPublisher`

  **Spec scenarios:** E1, E2, E3

  - [x] 5.1 RED — Write failing test: `src/payments/order-events.publisher.spec.ts` — asserts
    `publishOrderCreated(payload)` resolves the queue URL via `GetQueueUrlCommand` then sends a
    `SendMessageCommand` to `COMMON_SQS_CLIENT` with a JSON body matching the `ORDER_CREATED`
    envelope in `src/resources/asyncapis/payments.asyncapi.yml` (E1); asserts a rejected SQS call is
    caught and logged, not rethrown (E2); asserts two calls with different `orderId`s each send a
    separate message (E3)
  - [x] 5.2 GREEN — Create `src/payments/order-events.publisher.ts` — injects `COMMON_SQS_CLIENT`, resolves the queue URL from `OrderEventsQueueConfig` (`GetQueueUrlCommand`, cached), builds and sends the `ORDER_CREATED` message, catches and logs publish errors; also created `src/payments/order-created.event.ts` (`OrderCreatedEvent` DTO, `class-validator` decorated, matching `SampleEvent`'s convention)
  - [x] 5.3 REFACTOR — none

- [x] 6. `ProductsService` + `listProducts` wiring

  **Spec scenarios:** P1, P2, P3, P4

  - [x] 6.1 RED — Write failing test: `src/payments/products.service.spec.ts` — asserts
    `findActiveProducts()` returns only `status = 'ACTIVE'` rows mapped to
    `{id, name, sku, price, currency, stockQuantity, status}` (P1, P2, P4); asserts an empty result
    set returns `[]` (P3)
  - [x] 6.2 GREEN — Create `src/payments/products.service.ts` — plain `@Injectable()` using `PaymentsDataSourceProvider.getDataSource()`, queries the `CartProduct` repository filtered by status
  - [x] 6.3 (simplified) — `ProductsService` is tested standalone (plain constructor instantiation,
    no DI container needed for a unit test); actual `PaymentsModule`/`PaymentsController` wiring is
    done once, correctly, in Task 12 rather than building a throwaway minimal module here that
    Task 12 would immediately replace
  - [x] 6.4 REFACTOR — none

- [x] 7. `CheckoutService` — happy path

  **Spec scenarios:** C1, C8, E1, E2, E3

  - [x] 7.1 RED — Write failing test: `src/payments/checkout.service.spec.ts` — asserts
    `createOrder(userId, items)`, given valid items, computes subtotal/tax/shipping/total from
    fetched `CartProduct` rows (never from any client-passed amount), inserts `Order`/`OrderItem`
    rows, calls `RazorpayClientService.createOrder`, inserts `Payment`/`PaymentTransaction` rows,
    calls `OrderEventsPublisher.publishOrderCreated`, and returns
    `{orderId, razorpayOrderId, amount, currency, keyId}` (C1); asserts that when
    `RazorpayClientService.createOrder` rejects, no DB transaction/save is ever attempted (Razorpay
    is called before any DB write) and a `BadGatewayException` is thrown (C8); asserts
    `CheckoutService` still returns success even if `publishOrderCreated` rejects (E2); asserts
    calling `createOrder` twice produces two distinct orders with two distinct publisher calls (E3)
  - [x] 7.2 GREEN — Create `src/payments/checkout.service.ts` — plain `@Injectable()` using `PaymentsDataSourceProvider.getDataSource()` and `dataSource.transaction(...)`, orchestrating pricing, persistence, `RazorpayClientService`, and `OrderEventsPublisher`
  - [x] 7.3 REFACTOR — extracted `buildOrderItems()` and `buildPaymentRecords()` private helpers out of `createOrder`, which had grown past ~40 lines

- [x] 8. `CheckoutService` — validation & business-rule error paths

  **Spec scenarios:** C2, C3, C4, C5, C6, C7

  - [x] 8.1 RED — Extend `src/payments/checkout.service.spec.ts` — asserts an `amount`-like field
    in the request is never read/used (C2); asserts an unknown `productId` throws
    `NotFoundException` with no rows created (C3); asserts a `quantity` exceeding
    `stockQuantity` throws `ConflictException` with no rows created (C4); asserts an empty
    `items` array throws `BadRequestException` (C5); asserts `quantity <= 0`/non-integer
    throws `BadRequestException` (C6); asserts an unknown `userId` throws
    `NotFoundException` (C7)
  - [x] 8.2 GREEN — Modify `src/payments/checkout.service.ts` — add validation guards (empty items, non-integer/non-positive quantity, unknown user via a `User` repository lookup, unknown product, insufficient stock) before the persistence/Razorpay call sequence
  - [x] 8.3 REFACTOR — none

- [x] 9. `PaymentVerificationService`

  **Spec scenarios:** V1, V2, V3, V4, V5, V6

  - [x] 9.1 RED — Write failing test: `src/payments/payment-verification.service.spec.ts` —
    asserts a matching signature transitions `PaymentTransaction.status` to `CAPTURED` and
    `Order.status` to `PAID`, returning `{orderId, status: 'PAID', paymentStatus: 'CAPTURED'}` (V1);
    asserts a mismatched signature marks the transaction `FAILED` and does not change order status,
    throwing a 422-mappable error (V2); asserts the HMAC input always uses the
    `payment_transactions.provider_order_id` stored server-side, not the request body's
    `razorpayOrderId`, by constructing a test case where they differ and confirming the *stored*
    value is what's hashed (V3); asserts a nonexistent `orderId` throws a not-found-mappable error
    (V4); asserts calling verify again with the same already-`CAPTURED` transaction and same
    `razorpayPaymentId` returns success without re-running side effects, and with a *different*
    `razorpayPaymentId` is rejected (V5); asserts missing required fields throw a
    bad-request-mappable error (V6)
  - [x] 9.2 GREEN — Create `src/payments/payment-verification.service.ts` — plain `@Injectable()` using `PaymentsDataSourceProvider.getDataSource()` and the Task 4 signature utility
  - [x] 9.3 REFACTOR — none

- [x] 10. `WebhookService`

  **Spec scenarios:** W1, W2, W3, W4, W5, W6, W7

  **Note found during gen-impl:** Razorpay's real webhook envelope has no documented top-level
  unique event id (unlike Stripe); `specs/payments.yml`'s `RazorpayWebhookPayload` schema (already
  approved) doesn't model one either. Idempotency key is synthesized as
  `` `${event}:${paymentEntity.id ?? paymentEntity.order_id ?? randomUUID()}` `` — deterministic for
  a genuine duplicate delivery of the same event. **Also**, `handleWebhook` takes the raw body as a
  `string` parameter (not the parsed DTO) since HMAC verification needs the exact bytes Razorpay
  signed — capturing Fastify's raw body is a controller-level concern, handled in Task 12.

  - [x] 10.1 RED — Write failing test: `src/payments/webhook.service.spec.ts` — asserts a valid
    `payment.captured` event with a matching signature transitions `PaymentTransaction`/`Payment`/
    `Order` to `CAPTURED`/`CAPTURED`/`PAID` and records a `PaymentEvent` row (W1); asserts
    `payment.failed` transitions to `FAILED`/`FAILED`/`PAYMENT_FAILED` with `failureCode`/
    `failureReason` populated (W2); asserts an invalid signature throws with nothing persisted (W3);
    asserts a second delivery with the same synthesized event id is acknowledged
    (`DUPLICATE_IGNORED`) without reapplying state changes (W4); asserts a malformed body throws
    without crashing (W5); asserts an event whose `providerPaymentId`/`providerOrderId` matches no
    `PaymentTransaction` is recorded with `processingStatus: 'UNMATCHED'` and an `errorMessage`,
    without throwing (W6); asserts the full parsed payload is stored in `PaymentEvent.payload` (W7)
  - [x] 10.2 GREEN — Create `src/payments/webhook.service.ts` — plain `@Injectable()` using `PaymentsDataSourceProvider.getDataSource()` and the Task 4 signature utility; checks `PaymentEvent` by the synthesized `eventId` before applying any transition
  - [x] 10.3 REFACTOR — none

- [x] 11. `RefundsService`

  **Spec scenarios:** R1, R2, R3, R4, R5

  - [x] 11.1 RED — Write failing test: `src/payments/refunds.service.spec.ts` — asserts a `PAID`
    order with a `CAPTURED` transaction produces a Razorpay refund call, a new `Refund` row, and an
    order status move to `REFUND_PENDING` (R1); asserts a non-`PAID` order throws
    `ConflictException` with no Razorpay call (R2); asserts an order that already has a
    `Refund` row throws `ConflictException` with no duplicate Razorpay call (R3); asserts an
    unknown order id throws `NotFoundException` (R4); asserts a
    `RazorpayClientService.createRefund` rejection throws `BadGatewayException` with no `Refund`
    row created (R5)
  - [x] 11.2 GREEN — Create `src/payments/refunds.service.ts` — plain `@Injectable()` using `PaymentsDataSourceProvider.getDataSource()` and `RazorpayClientService.createRefund`
  - [x] 11.3 REFACTOR — none

- [x] 12. `PaymentsController` + `PaymentsModule` wiring

  **Spec scenarios:** integration (all)

  **Bugs found and fixed during gen-impl (both confirmed by actually running the test/build, not
  just inspecting code):**
  1. Jest's `moduleNameMapper` for `@generated/*` pointed at `<rootDir>/generated/$1` where
     `rootDir` is `src` — i.e. `src/generated`, but the real generated output is at the project
     root (`generated/`), matching `tsconfig.json`'s path mapping. Never caught before because no
     prior spec imported anything from `@generated`. Fixed in `package.json`'s `jest.moduleNameMapper`
     to `<rootDir>/../generated/$1`.
  2. Fastify parses the JSON body before any controller method runs, so the generated
     `handleRazorpayWebhook(body: RazorpayWebhookPayloadDto, ...)` never has access to the exact
     bytes Razorpay signed — required for HMAC verification. Solved with a Fastify
     `addContentTypeParser('application/json', ...)` override in `main.ts` that stashes the raw
     string on `request.rawBody` alongside the normal parsed body; `PaymentsController` is made
     request-scoped (injects `REQUEST`) purely to read that raw body.

  - [x] 12.1 RED — Write failing test: `src/payments/payments.controller.spec.ts` — asserts each
    of the 5 controller methods delegates to the corresponding service (mocked) and returns its
    result unchanged; asserts a service error thrown from `createCheckoutOrder` propagates
    unchanged through the controller; asserts `handleRazorpayWebhook` uses the request's
    `rawBody`, not a re-serialization of the parsed DTO
  - [x] 12.2 GREEN — Create `src/payments/payments.controller.ts` — extends
    `PaymentsControllerBase` from `generated/payments/payments.controller.base.ts`, request-scoped
    (injects `REQUEST` for `rawBody`), implements all 5 abstract methods by delegating to
    `ProductsService`, `CheckoutService`, `PaymentVerificationService`, `WebhookService`,
    `RefundsService`
  - [x] 12.3 GREEN — Create `src/payments/payments.module.ts` — assembles all services from Tasks
    1-11, imports `AwsModule` (for `COMMON_SQS_CLIENT`), registers `PaymentsController`
  - [x] 12.4 GREEN — Modify `src/contract-first/module.ts` — import `PaymentsModule` alongside
    `HawbCommandController`/`FlightsController`; modify `src/main.ts` to add the raw-body content
    type parser
  - [x] 12.5 REFACTOR — none

---

## Quality Gate

- [x] QG.1 Tests — all passing (`npm test`) — 74/74 passing across 15 suites
- [x] QG.2 Coverage — ≥ 95% (`npm run test:cov`) — 98.79% statements on `src/payments/**`
  (excluding `payments.module.ts`, pure DI wiring with no branching logic); added a real test for
  `OrderCreatedEvent`'s `class-validator` decorators to close a genuine gap rather than pad the
  number
- [x] QG.3 Lint — 0 violations (`npm run lint`)
- [x] QG.4 Static analysis — 0 blockers (`npx tsc --noEmit -p tsconfig.json`)
- [x] QG.5 SAST — 0 findings (`eslint-plugin-security` full recommended rule set, run ad hoc
  against `src/payments/**` without modifying the shared `.eslintrc.js`; added as a devDependency)
- [x] QG.6 Dependency audit — `yarn audit --level high` reports 453 pre-existing vulnerabilities
  (243 high, 13 critical) in this repo's overall dependency tree — all from packages that predate
  this story (`jest`'s transitive `picomatch` ReDoS, `@snow-tzu/nest-openapi-code-generator`'s
  transitive `lodash` code-injection issue, etc.). Confirmed neither `razorpay` nor
  `eslint-plugin-security` (the only 2 packages this story added) appear in any finding. Flagging
  this repo-wide debt to the engineer rather than silently passing over it — it is out of scope for
  this story to remediate 453 pre-existing findings, but it should not go unmentioned.
- [x] QG.7 Secret scan — clean. Only dummy/test placeholder values in spec files (e.g.
  `'dummy_secret'`, `'test_webhook_secret'`); the real Razorpay test-mode credentials live only in
  the gitignored `.env`, confirmed absent from `git diff`/untracked file list.

---

## Commit Strategy

| Cluster | Tasks | Suggested Commit Message |
|---------|-------|---------------------------|
| 1 — Foundation | 1, 2, 3, 4, 5 | `feat(payments): entities, config, Razorpay client, signature utils, order-events publisher` |
| 2 — Catalog & Checkout | 6, 7, 8 | `feat(payments): product listing and checkout order creation` |
| 3 — Verification & Webhooks | 9, 10 | `feat(payments): Razorpay payment verification and webhook handling` |
| 4 — Refunds & Wiring | 11, 12 | `feat(payments): refunds and controller/module wiring` |
