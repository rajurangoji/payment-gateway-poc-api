# Proposal: Razorpay Payment Integration (Backend)

## Story Statement

As a customer completing checkout on the storefront, I want to pay for my cart using
Razorpay (UPI / Cards / Net Banking / Wallets), so that my order is reliably marked PAID
only after a verified payment — never based on an unverified frontend claim.

## Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | The demo catalog has ACTIVE products in `cart_products` | A client calls `GET /api/products` | The response lists `id, name, sku, price, currency, stockQuantity, status` for all ACTIVE products |
| AC2 | A user has selected valid product IDs and quantities | A client calls `POST /api/checkout/create-order` with `{ userId, items }` | The backend re-fetches prices/stock from `cart_products` (ignores any client-sent amount), computes subtotal/tax/shipping/total, creates `orders` + `order_items` rows, creates a Razorpay Order via the Razorpay Orders API for the computed total (in paise), stores a `payments` row (provider=RAZORPAY, status=CREATED) and a `payment_transactions` row (status=CREATED, provider_order_id set), and returns `{ orderId, razorpayOrderId, amount, currency, keyId }` |
| AC3 | A checkout was created and the customer completed Razorpay Checkout | A client calls `POST /api/payments/razorpay/verify` with `{ orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }` | The backend looks up the stored `provider_order_id` for that order (never trusting the browser's `razorpayOrderId` as the source of truth), recomputes `HMAC_SHA256(razorpay_order_id + "\|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`, and on match updates `payment_transactions.status` to CAPTURED and `orders.status` to PAID; on mismatch, marks the transaction FAILED and returns an error without changing order status |
| AC4 | Razorpay sends a webhook event | Razorpay calls `POST /api/webhooks/razorpay` with a signed payload | The backend verifies `X-Razorpay-Signature` via HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET` and the raw body; on success it records the event in `payment_events` keyed by `event_id`, and applies `payment.authorized` / `payment.captured` / `payment.failed` state transitions to `payment_transactions` and `orders`; on signature mismatch it returns 400 without persisting state changes |
| AC5 | Razorpay redelivers the same webhook event (duplicate delivery) | `POST /api/webhooks/razorpay` is called twice with the same `event_id` | The second delivery is recognized as already-processed (via the unique `event_id` in `payment_events`) and is acknowledged without reapplying state changes |
| AC6 | An order has been PAID and the customer requests cancellation | A client calls `POST /api/orders/:id/refund` | The backend calls the Razorpay Refunds API for the associated `payment_transaction`, inserts a `refunds` row, and moves the order toward CANCELLED/REFUNDED status |

## Tech Design Note (Stack)

- Backend: NestJS (Fastify adapter), contract-first OpenAPI (`specs/*.yml` → `generated/` via
  `npx openapi-generate` → implemented under `src/contract-first` or a new `src/payments` module)
- DB: PostgreSQL via TypeORM raw `QueryRunner` migrations (no entity classes). Schema already
  migrated: `users, cart_products, orders, order_items, payments, payment_transactions, refunds,
  payment_events`
- Payment provider: Razorpay (`razorpay` npm SDK), Test Mode keys already in `.env`
  (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
- Reference flow doc: `razorpay-payments/architecture.md` (Phase 1 scope)

## Context Links

- `architecture.md` — payment lifecycle diagram and security checklist
- `src/migrations/1755000000000-CreateUsersTable.ts` through
  `1755000008000-SeedDummyCartProducts.ts` — schema + dummy seed data already applied

## Out of Scope (Phase 2, later)

- Partial refunds beyond a single full refund per order
- Payment retries
- Multi-provider abstraction (Cashfree/Stripe) — Razorpay only for this story
- KYC / going live — Test Mode only
