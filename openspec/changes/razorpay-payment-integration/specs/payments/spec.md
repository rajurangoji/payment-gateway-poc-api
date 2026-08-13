## ADDED Requirements

### Requirement: Product Catalog Listing
The system SHALL expose a read-only listing of active products from `cart_products` so the
storefront can render a catalog and let customers build a cart.

#### Scenario: List active products — happy path
- **Type**: happy
- **GIVEN** `cart_products` contains rows with `status = 'ACTIVE'`
- **WHEN** a client calls `GET /api/products`
- **THEN** the response is 200 with an array of objects containing exactly `id, name, sku, price,
  currency, stockQuantity, status` per product

#### Scenario: Non-active products are excluded
- **Type**: boundary
- **GIVEN** `cart_products` contains rows with `status` in `INACTIVE`, `OUT_OF_STOCK`,
  `DISCONTINUED`
- **WHEN** a client calls `GET /api/products`
- **THEN** those rows are excluded from the response

#### Scenario: Empty catalog
- **Type**: boundary
- **GIVEN** no `cart_products` rows have `status = 'ACTIVE'`
- **WHEN** a client calls `GET /api/products`
- **THEN** the response is 200 with an empty array (not an error)

#### Scenario: Response excludes internal fields
- **Type**: security
- **GIVEN** a product row that also has `user_id`, `created_at`, `updated_at`
- **WHEN** the product list is serialized
- **THEN** the response contains only the documented fields — no `user_id`, no timestamps, no
  internal database identifiers beyond the product `id`

---

### Requirement: Checkout Order Creation
The system SHALL create an ecommerce order and a corresponding Razorpay order from
server-recomputed pricing, never from a client-supplied amount.

#### Scenario: Create order — happy path
- **Type**: happy
- **GIVEN** a valid `userId` and a non-empty list of `{ productId, quantity }` referencing ACTIVE
  products with sufficient `stock_quantity`
- **WHEN** a client calls `POST /api/checkout/create-order`
- **THEN** the backend re-fetches current prices from `cart_products`, computes
  subtotal/tax/shipping/discount/total server-side, inserts `orders` (status `PENDING_PAYMENT`) and
  `order_items` rows, calls the Razorpay Orders API for the computed total in paise, inserts a
  `payments` row (`provider = RAZORPAY`, `status = CREATED`) and a `payment_transactions` row
  (`status = CREATED`, `provider_order_id` set), and returns
  `{ orderId, razorpayOrderId, amount, currency, keyId }`

#### Scenario: Client-supplied amount is ignored
- **Type**: security
- **GIVEN** a request body that includes an `amount` (or similarly named total) field with a value
  lower than the true computed total
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the extraneous field is ignored entirely — the Razorpay order and stored `orders.total_amount`
  reflect only the server-computed total, never the client value

#### Scenario: Unknown product ID
- **Type**: error
- **GIVEN** an `items` entry references a `productId` that does not exist in `cart_products`
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the response is 400/404 with a descriptive error, and no `orders`/`order_items`/
  `payments` rows are created

#### Scenario: Insufficient stock
- **Type**: error
- **GIVEN** a requested `quantity` exceeds a product's current `stock_quantity`
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the response is 409 (conflict) with a descriptive error, and no rows are created for
  this order

#### Scenario: Empty items array
- **Type**: boundary
- **GIVEN** `items` is an empty array
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the response is 400 — an order cannot be created with zero items

#### Scenario: Missing or invalid quantity
- **Type**: boundary
- **GIVEN** an `items` entry has `quantity <= 0`, non-integer, or missing
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the response is 400

#### Scenario: Unknown user
- **Type**: error
- **GIVEN** `userId` does not exist in `users`
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the response is 400/404 and no order is created

#### Scenario: Razorpay Orders API unavailable
- **Type**: error
- **GIVEN** the Razorpay Orders API call fails or times out
- **WHEN** `POST /api/checkout/create-order` is called
- **THEN** the operation fails atomically — no dangling `orders`/`order_items`/`payments` rows are
  left behind without a corresponding Razorpay order; the response is 502/503 with a descriptive
  error
- **Notes**: implement as a DB transaction that only commits after the Razorpay call succeeds, or
  compensates (marks the order FAILED) if it doesn't

#### Scenario: ORDER_CREATED event published — message envelope
- **Type**: event
- **GIVEN** `POST /api/checkout/create-order` has successfully created the `orders`/`order_items`
  rows **and** the Razorpay order
- **WHEN** the use case finishes creating both
- **THEN** an `ORDER_CREATED` message is sent to SQS (via `COMMON_SQS_CLIENT` /
  `SendMessageCommand`, following the existing `SqsClientProvider` pattern in
  `src/shared/sqs`, with the target queue name added to `queues.config.ts` the same way
  `queues.example` is registered) containing:
    - `type`: `"ORDER_CREATED"` (required)
    - `orderId`: string — our internal order id (required)
    - `orderNumber`: string (required)
    - `userId`: string (required)
    - `razorpayOrderId`: string (required)
    - `totalAmount`: number (required)
    - `currency`: string (required)
    - `status`: string — `PENDING_PAYMENT` (required)
    - `at`: ISO-8601 timestamp (required)
- **Notes**: this scenario drives the AsyncAPI/event contract shape in Stage 2; validate the message
  body with `class-validator`, matching the existing `SampleEvent` convention in
  `src/events/sample.event.ts`

#### Scenario: ORDER_CREATED publish failure does not fail the checkout response
- **Type**: error
- **GIVEN** the `orders`/`order_items`/`payments`/`payment_transactions` rows and the Razorpay
  order were all created successfully
- **WHEN** the subsequent SQS `SendMessage` call for `ORDER_CREATED` fails or times out
- **THEN** `POST /api/checkout/create-order` still returns its normal 2xx success response — the
  order is the source of truth and must not be rolled back or hidden from the customer just because
  a downstream queue publish failed
- **Notes**: log the publish failure for follow-up/retry; do not block or fail the HTTP response on
  it

#### Scenario: Duplicate ORDER_CREATED publish on client retry
- **Type**: event
- **GIVEN** a client double-submits `POST /api/checkout/create-order` (see the existing
  "no idempotency key" gap below)
- **WHEN** two separate orders are created as a result
- **THEN** two separate `ORDER_CREATED` messages are sent to SQS — one per distinct `orderId` —
  since each represents a genuinely distinct order in this POC (no create-order idempotency key
  exists to collapse them into one)

---

### Requirement: Razorpay Payment Verification
The system SHALL verify the authenticity of a completed checkout server-side via HMAC-SHA256
signature comparison before ever marking an order PAID.

#### Scenario: Verify payment — happy path
- **Type**: happy
- **GIVEN** a `payment_transactions` row exists for `orderId` with a stored `provider_order_id`
- **WHEN** a client calls `POST /api/payments/razorpay/verify` with
  `{ orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }` and
  `HMAC_SHA256(stored_provider_order_id + "|" + razorpayPaymentId, RAZORPAY_KEY_SECRET)` equals
  `razorpaySignature`
- **THEN** `payment_transactions.status` moves to `CAPTURED` (or `AUTHORIZED` then `CAPTURED` per
  auto-capture), `payment_transactions.provider_payment_id` is set, and `orders.status` moves to
  `PAID`

#### Scenario: Invalid signature is rejected
- **Type**: security
- **GIVEN** the same setup as above
- **WHEN** the computed HMAC does not match the supplied `razorpaySignature` (tampered or forged)
- **THEN** the response is 400/422, `payment_transactions.status` moves to `FAILED`, and
  `orders.status` is **not** changed to `PAID`

#### Scenario: Verification uses the server's stored order id, not the browser's
- **Type**: security
- **GIVEN** a `payment_transactions` row for `orderId` with stored `provider_order_id = order_A`
- **WHEN** a client calls verify with `razorpayOrderId = order_B` (a different, possibly valid,
  Razorpay order id) and a signature computed against `order_B`
- **THEN** verification uses the **stored** `provider_order_id` (`order_A`) for the HMAC comparison,
  not the client-supplied `razorpayOrderId` — the mismatched attempt is rejected

#### Scenario: Verify called for a nonexistent order
- **Type**: error
- **GIVEN** `orderId` does not correspond to any `payment_transactions` row
- **WHEN** `POST /api/payments/razorpay/verify` is called
- **THEN** the response is 404 and no state changes occur

#### Scenario: Duplicate verification of an already-captured payment
- **Type**: state-transition
- **GIVEN** `payment_transactions.status` is already `CAPTURED` for this order with a stored
  `provider_payment_id`
- **WHEN** `POST /api/payments/razorpay/verify` is called again (same or different payment id)
- **THEN** the request is treated idempotently — if it's the same `provider_payment_id` with a
  valid signature, the endpoint returns success without reapplying side effects (e.g., no double
  stock decrement, no duplicate fulfilment trigger); if it references a **different**
  `provider_payment_id` for an already-captured order, it is rejected (prevents overwriting a
  captured transaction)

#### Scenario: Missing required fields
- **Type**: boundary
- **GIVEN** the request body is missing `orderId`, `razorpayPaymentId`, `razorpayOrderId`, or
  `razorpaySignature`
- **WHEN** `POST /api/payments/razorpay/verify` is called
- **THEN** the response is 400

---

### Requirement: Razorpay Webhook Handling
The system SHALL accept Razorpay webhook events, verify their signature, and apply payment state
transitions idempotently, independent of whether the browser-side verify call ever happens.

#### Scenario: payment.captured webhook — happy path
- **Type**: happy
- **GIVEN** a valid, signed Razorpay webhook payload for `payment.captured`
- **WHEN** Razorpay calls `POST /api/webhooks/razorpay`
- **THEN** the signature is verified via HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET` and the raw
  body, the event is recorded in `payment_events` (unique `event_id`), and
  `payment_transactions`/`orders` transition to `CAPTURED`/`PAID`

#### Scenario: payment.failed webhook
- **Type**: happy
- **GIVEN** a valid, signed Razorpay webhook payload for `payment.failed`
- **WHEN** Razorpay calls `POST /api/webhooks/razorpay`
- **THEN** `payment_transactions.status` moves to `FAILED` (with `failure_code`/`failure_reason`
  populated from the payload) and `orders.status` moves to `PAYMENT_FAILED`

#### Scenario: Invalid webhook signature is rejected
- **Type**: security
- **GIVEN** the `X-Razorpay-Signature` header is missing or does not match the HMAC of the raw
  request body computed with `RAZORPAY_WEBHOOK_SECRET`
- **WHEN** `POST /api/webhooks/razorpay` is called
- **THEN** the response is 400 and **no** row is written to `payment_events` and no state changes
  occur

#### Scenario: Duplicate webhook delivery is idempotent
- **Type**: state-transition
- **GIVEN** an event with `event_id = evt_123` has already been recorded in `payment_events`
- **WHEN** `POST /api/webhooks/razorpay` is called again with the same `event_id`
- **THEN** the request is acknowledged (200) but no state transition is reapplied and no duplicate
  `payment_events` row is inserted (enforced by the existing unique constraint on `event_id`)

#### Scenario: Malformed payload
- **Type**: boundary
- **GIVEN** the request body is not valid JSON or is missing required envelope fields
- **WHEN** `POST /api/webhooks/razorpay` is called
- **THEN** the response is 400 and the handler does not crash

#### Scenario: Event references an unknown transaction
- **Type**: error
- **GIVEN** a webhook's `provider_order_id`/`provider_payment_id` does not match any
  `payment_transactions` row (e.g., a stray or test event)
- **WHEN** `POST /api/webhooks/razorpay` is called
- **THEN** the event is still recorded in `payment_events` (for audit/reconciliation) with
  `processing_status = 'UNMATCHED'` and an `error_message`, and the endpoint returns 200 (to avoid
  Razorpay retry storms) rather than 4xx/5xx
- **Notes**: confirm this reconciliation behavior matches operational expectations — see Gaps

#### Scenario: Full message envelope is captured
- **Type**: event
- **GIVEN** any valid webhook delivery
- **WHEN** it is processed
- **THEN** the full raw payload is stored in `payment_events.payload` (JSONB) along with `provider,
  event_id, event_type, provider_payment_id, provider_order_id, signature, processing_status,
  processed_at` — this is the audit trail if any transition logic needs to be replayed later

---

### Requirement: Order Refund
The system SHALL support issuing a full refund for a paid order via the Razorpay Refunds API.

#### Scenario: Refund a paid order — happy path
- **Type**: happy
- **GIVEN** an order with `status = PAID` and a `payment_transactions` row with `status = CAPTURED`
- **WHEN** a client calls `POST /api/orders/:id/refund`
- **THEN** the backend calls the Razorpay Refunds API for the matching `payment_transaction`,
  inserts a `refunds` row (`status = CREATED` or as returned by Razorpay), and moves
  `orders.status` toward `REFUND_PENDING`/`REFUNDED`

#### Scenario: Refund an order that was never paid
- **Type**: error
- **GIVEN** an order with `status` other than `PAID` (e.g., `PENDING_PAYMENT`, `PAYMENT_FAILED`)
- **WHEN** `POST /api/orders/:id/refund` is called
- **THEN** the response is 409 and no Razorpay refund call is made

#### Scenario: Refund an already-refunded order
- **Type**: error
- **GIVEN** an order that already has a `refunds` row for its `payment_transaction`
- **WHEN** `POST /api/orders/:id/refund` is called again
- **THEN** the response is 409 — no duplicate Razorpay refund call and no duplicate `refunds` row

#### Scenario: Refund a nonexistent order
- **Type**: error
- **GIVEN** `:id` does not match any `orders` row
- **WHEN** `POST /api/orders/:id/refund` is called
- **THEN** the response is 404

#### Scenario: Razorpay Refunds API failure
- **Type**: error
- **GIVEN** the Razorpay Refunds API call fails or times out
- **WHEN** `POST /api/orders/:id/refund` is called
- **THEN** `orders.status` is unchanged, no `refunds` row is created, and the response is 502/503

---

## Domain Invariants (Property Test Candidates)

- **order-total-consistency**: `orders.total_amount == orders.subtotal_amount -
  orders.discount_amount + orders.tax_amount + orders.shipping_amount`, always recomputed
  server-side and never accepted verbatim from a client.
- **payment-amount-matches-order**: `payments.amount == orders.total_amount` for the `orders` row
  it's linked to (1:1 relationship).
- **provider-payment-id-uniqueness**: `payment_transactions.provider_payment_id` is unique across
  the whole table (already enforced by a DB unique constraint) — no two transactions can claim the
  same Razorpay payment.
- **event-id-uniqueness**: `payment_events.event_id` is unique — the basis for webhook idempotency
  (already enforced by a DB unique constraint).
- **paid-requires-captured-transaction**: An order can only reach `orders.status = PAID` after its
  linked `payment_transactions.status` has reached `CAPTURED` server-side — never as a direct
  side-effect of a browser callback alone.
- **stock-never-negative**: `cart_products.stock_quantity` never goes below zero as a result of
  order creation.

## Gaps / Open Questions

- **No authentication/authorization layer exists in this codebase yet** (no guards, no JWT, no
  session concept — confirmed by inspecting `app.module.ts` and the module tree). All endpoints in
  this story are therefore effectively public. The standard 401/403/IDOR security scenarios this
  template normally requires are not applicable until an auth layer is introduced — noting this
  explicitly rather than fabricating scenarios for infrastructure that doesn't exist. Recommend
  treating this as a tracked follow-up before any real (non-Test-Mode) deployment.
- **No idempotency key requested for `POST /api/checkout/create-order`.** A double-click on "Pay
  Now" (client-side retry) could create two separate orders + two Razorpay orders. Recommend an
  idempotency key or debounce in a later iteration; not blocking for this POC.
- **Webhook endpoint has no application-level rate limiting.** Signature verification is the
  primary defense for this POC; add rate limiting if this becomes internet-facing beyond a POC.
- **Stock decrement timing assumption**: this spec assumes `cart_products.stock_quantity` is
  decremented at order-creation time (reserved immediately) rather than at payment-capture time, to
  prevent oversell during the payment window. Confirm this matches intent — if not, stock should
  decrement on the `payment.captured` transition instead, with a background job to release
  reservations for abandoned/expired `PENDING_PAYMENT` orders.
- **Unmatched webhook event handling** (see "Event references an unknown transaction" scenario)
  returns 200 with an `UNMATCHED` audit record rather than an error, to avoid Razorpay retry storms.
  Confirm this operational choice.
- **New queue required for `ORDER_CREATED`**: a new SQS queue name must be registered in
  `queues.config.ts` (e.g. `orderEvents: { name: process.env.SQS_ORDER_EVENTS_QUEUE ?? 'order-events-queue' }`,
  following the existing `queues.example` pattern) and the corresponding env var added to
  `.env`/`.env.example`. This story does not specify a consumer for the queue — publishing is
  fire-and-forget from the payments side; whatever downstream system consumes `ORDER_CREATED` is
  out of scope here.
