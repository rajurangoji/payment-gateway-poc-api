Yes. For an **e-commerce website**, Razorpay integration is fairly straightforward, but the important part is not just opening the Razorpay checkout. You need to design the **order + payment + verification + webhook + refund/failure** flow correctly.

For your POC, I would recommend implementing **Razorpay Standard Checkout + Orders API + server-side signature verification + Webhooks**. Razorpay itself recommends this flow for web integrations. ([Razorpay][1])

## 1. Overall architecture

Assuming your ecommerce application looks something like:

**Frontend**

* React / Next.js / Angular

**Backend**

* Node.js / NestJS / Express

**Database**

* PostgreSQL / MySQL etc.

The payment flow should look like this:

```text
Customer
   |
   | 1. Add products to cart
   v
E-commerce Frontend
   |
   | 2. Click "Pay Now"
   v
Your Backend
   |
   | 3. Validate cart + calculate final amount
   |
   | 4. Create your Order
   |
   | 5. Create Razorpay Order
   v
Razorpay
   |
   | 6. Return razorpay_order_id
   v
Frontend
   |
   | 7. Open Razorpay Checkout
   v
Customer
   |
   | 8. UPI / Card / Net Banking / Wallet
   v
Razorpay
   |
   | 9. Payment completed
   v
Frontend
   |
   | 10. payment_id + order_id + signature
   v
Your Backend
   |
   | 11. Verify signature
   |
   | 12. Mark payment/order appropriately
   v
Database

                  Razorpay
                     |
                     | 13. Webhook
                     v
              Your Backend
                     |
                     | 14. Confirm final status
                     v
                  Database
```

The important thing is:

> **Never trust the frontend saying "payment successful".**

The frontend is controlled by the customer/browser. Your backend must verify the payment before considering the order paid. Razorpay specifically requires server-side signature verification. ([Razorpay][1])

---

# 2. First: Create Razorpay account

You need a Razorpay merchant account.

You'll eventually have:

```text
Razorpay Dashboard
       |
       +-- Test Mode
       |     |
       |     +-- Key ID
       |     +-- Key Secret
       |
       +-- Live Mode
             |
             +-- Key ID
             +-- Key Secret
```

For the POC, use **Test Mode**.

Razorpay requires business/KYC verification before you can go live and accept real payments. ([Razorpay][2])

---

# 3. Understand the two keys

You'll get:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

For example:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
```

### Key ID

This can be used by the frontend.

Example:

```javascript
key: "rzp_test_xxxxxxxxx"
```

### Key Secret

**NEVER expose this to frontend.**

It must remain on your backend.

```text
Frontend
   |
   | Key ID ✅
   |
Backend
   |
   | Key ID + Key Secret ✅
```

Never:

```text
Frontend
   |
   | Key Secret ❌
```

---

# 4. Decide your database payment model

This is one of the most important parts for an ecommerce application.

Don't just store:

```text
order.payment_status = PAID
```

I would recommend having something like:

### `orders`

```text
id
user_id
order_number
total_amount
currency
status
created_at
updated_at
```

Example:

```text
id:           UUID
order_number: ORD-20260811-0001
total_amount: 2499.00
currency:     INR
status:       PENDING
```

### `payments`

```text
id
order_id
provider
provider_order_id
provider_payment_id
amount
currency
status
signature
created_at
updated_at
```

Example:

```text
id:                    UUID
order_id:              ORD-123
provider:              RAZORPAY
provider_order_id:     order_xxxxx
provider_payment_id:   pay_xxxxx
amount:                2499
currency:              INR
status:                CREATED
```

This makes it easier if you later support:

```text
RAZORPAY
STRIPE
PAYU
CASHFREE
```

without changing your entire ecommerce order system.

---

# 5. Create your own ecommerce order first

Suppose the customer has:

```text
iPhone case       ₹999
T-shirt           ₹1,500
-------------------------
Total             ₹2,499
```

Customer clicks:

**Pay Now**

Your frontend should call something like:

```http
POST /api/orders
```

or:

```http
POST /api/checkout/create
```

Your backend should:

1. Get cart
2. Validate products
3. Validate inventory
4. Calculate prices
5. Apply discounts
6. Calculate tax
7. Calculate shipping
8. Calculate final amount

**Do not accept the final amount blindly from frontend.**

For example, don't do:

```json
{
  "amount": 2499
}
```

and trust it.

A malicious user could change it to:

```json
{
  "amount": 1
}
```

Instead:

```text
Frontend
   |
   | product IDs
   | quantities
   v
Backend
   |
   +-- Fetch product prices
   +-- Validate stock
   +-- Calculate discount
   +-- Calculate tax
   +-- Calculate shipping
   |
   v
₹2499
```

---

# 6. Create Razorpay Order

Now your backend calls Razorpay.

Conceptually:

```http
POST https://api.razorpay.com/v1/orders
```

with something like:

```json
{
  "amount": 249900,
  "currency": "INR",
  "receipt": "ORD-123"
}
```

Notice:

```text
₹2,499
```

becomes:

```text
249900 paise
```

because Razorpay expects the amount in the smallest currency unit.

Razorpay's documentation explicitly requires creating an Order server-side before initiating Checkout, and payments without an `order_id` cannot be captured. ([Razorpay][3])

---

# 7. Store Razorpay Order ID

Razorpay returns something like:

```json
{
  "id": "order_xxxxxxxxx",
  "entity": "order",
  "amount": 249900,
  "currency": "INR",
  "status": "created"
}
```

Store:

```text
orders
-------------------------
id
order_number
total_amount
status

payments
-------------------------
id
order_id
provider
provider_order_id
status
```

Example:

```text
Order:
ORD-123
₹2499
PENDING

Payment:
provider = RAZORPAY
provider_order_id = order_xxxxx
status = CREATED
```

---

# 8. Send Razorpay Order ID to frontend

Your backend response can be:

```json
{
  "orderId": "ORD-123",
  "razorpayOrderId": "order_xxxxx",
  "amount": 249900,
  "currency": "INR",
  "keyId": "rzp_test_xxxxx"
}
```

The frontend then opens Razorpay Checkout.

---

# 9. Open Razorpay Checkout

Your frontend integrates Razorpay Checkout.

Conceptually:

```javascript
const options = {
  key: razorpayKeyId,
  amount: 249900,
  currency: "INR",
  order_id: "order_xxxxx",

  handler: function (response) {
    // Send response to backend
  }
};

const razorpay = new Razorpay(options);

razorpay.open();
```

The customer sees the Razorpay payment interface.

They can select the available payment methods such as:

```text
UPI
Cards
Net Banking
Wallets
Other enabled methods
```

---

# 10. Payment succeeds

Razorpay gives the frontend something like:

```json
{
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_order_id": "order_xxxxx",
  "razorpay_signature": "xxxxx"
}
```

The frontend should send these to your backend.

For example:

```http
POST /api/payments/razorpay/verify
```

```json
{
  "orderId": "ORD-123",
  "razorpayPaymentId": "pay_xxxxx",
  "razorpayOrderId": "order_xxxxx",
  "razorpaySignature": "xxxxx"
}
```

---

# 11. Verify the Razorpay signature

This is **mandatory**.

Your backend takes:

```text
your original Razorpay order ID
+
razorpay payment ID
+
Razorpay secret
```

and generates an HMAC-SHA256 signature.

Conceptually:

```text
HMAC_SHA256(
    razorpay_order_id + "|" + razorpay_payment_id,
    RAZORPAY_KEY_SECRET
)
```

Then:

```text
Generated Signature
        |
        | compare
        v
razorpay_signature
```

If:

```text
match
```

then the payment response is authentic.

If:

```text
doesn't match
```

reject it.

Razorpay specifically says the `order_id` used for verification should come from your server/database, **not blindly from the browser response**. ([Razorpay][1])

---

# 12. But signature verification isn't the whole story

This is a very important point.

You shouldn't think:

```text
signature verified = money received
```

There is also payment status.

Razorpay payment can have states such as:

```text
created
authorized
captured
failed
refunded
```

An `authorized` payment is not yet the same as a captured payment. Razorpay recommends auto-capture for most ecommerce scenarios. ([Razorpay][2])

For an ecommerce website, I would generally configure:

```text
Auto Capture
```

So the flow becomes:

```text
Customer pays
      ↓
Payment authorized
      ↓
Payment captured
      ↓
Order can be fulfilled
```

Razorpay states that uncaptured authorized payments are automatically refunded after the relevant period. ([Razorpay][1])

---

# 13. Webhooks — VERY IMPORTANT

This is another thing you absolutely should implement.

Suppose:

```text
Customer pays
     ↓
Razorpay says success
     ↓
Customer closes browser
```

Your frontend callback may never reach your backend.

So you need:

```text
Razorpay
    |
    | webhook
    v
POST /api/webhooks/razorpay
```

Razorpay sends payment events to your backend independently of the browser. This is why webhooks should be used for reliable server-side payment automation. ([Razorpay][1])

---

# 14. Webhook flow

For example:

```text
Razorpay
    |
    | payment.captured
    v
Your Backend
    |
    +-- Verify webhook signature
    |
    +-- Find payment
    |
    +-- Update payment status
    |
    +-- Update ecommerce order
    |
    +-- Trigger fulfilment
```

Your database could become:

```text
orders
--------------------------------
ORD-123
PAID
₹2499


payments
--------------------------------
RAZORPAY
order_xxxxx
pay_xxxxx
CAPTURED
₹2499
```

---

# 15. Webhook security

Don't simply accept:

```http
POST /api/webhooks/razorpay
```

from anyone.

Razorpay webhooks contain a signature.

You should verify:

```text
X-Razorpay-Signature
```

using your webhook secret.

Razorpay recommends validating every webhook signature. ([Razorpay][2])

---

# 16. Idempotency is important

Imagine Razorpay sends the same webhook twice.

```text
payment.captured
payment.captured
```

Your system shouldn't create two orders or send the product twice.

You need logic like:

```text
if payment_id already processed:
       return success
else:
       process payment
```

For example:

```text
razorpay_payment_id = pay_123
```

should be unique in your database.

This is especially important for ecommerce systems.

---

# 17. Recommended status flow

I'd design your order states separately from payment states.

### Order

```text
PENDING_PAYMENT
        ↓
PAID
        ↓
PROCESSING
        ↓
SHIPPED
        ↓
DELIVERED
```

Possible failure:

```text
PENDING_PAYMENT
        ↓
PAYMENT_FAILED
```

Cancellation:

```text
PAID
  ↓
CANCELLED
  ↓
REFUND_PENDING
  ↓
REFUNDED
```

### Payment

```text
CREATED
   ↓
AUTHORIZED
   ↓
CAPTURED
```

or:

```text
CREATED
   ↓
FAILED
```

or:

```text
CAPTURED
   ↓
REFUNDED
```

Keeping these separate will save you a lot of problems later.

---

# 18. Refund flow

You also need to think about refunds during the POC.

Example:

```text
Customer
   |
   | ₹2499
   v
Razorpay
   |
   | Payment captured
   v
Your Order
```

Later:

```text
Customer cancels order
       |
       v
Your Backend
       |
       | Razorpay Refund API
       v
Razorpay
       |
       v
Customer
```

Your DB:

```text
payment_status = REFUNDED
order_status = CANCELLED
```

You should also support **partial refunds** if your business requires them.

---

# 19. What APIs do you actually need?

For the initial POC, don't try to implement every Razorpay API.

I'd start with:

### Your APIs

```http
POST /api/checkout/create-order
```

Creates your ecommerce order + Razorpay order.

```http
POST /api/payments/razorpay/verify
```

Verifies checkout response.

```http
POST /api/webhooks/razorpay
```

Receives Razorpay events.

Later:

```http
POST /api/orders/:id/refund
```

for refunds.

Potentially:

```http
GET /api/orders/:id/payment
```

for payment status.

---

# 20. Recommended POC scope

For your first POC, I would **not** build the entire payment ecosystem.

Build only:

### Phase 1

```text
Product
   ↓
Cart
   ↓
Checkout
   ↓
Create Order
   ↓
Razorpay Order
   ↓
Razorpay Checkout
   ↓
Payment
   ↓
Signature Verification
   ↓
Webhook
   ↓
Order PAID
```

Then test:

```text
SUCCESS
FAILURE
USER CLOSES CHECKOUT
WEBHOOK
DUPLICATE WEBHOOK
PAYMENT AUTHORIZED
PAYMENT CAPTURED
PAYMENT FAILED
```

Then Phase 2:

```text
Refund
Partial Refund
Payment Status
Order Cancellation
Retry Payment
```

---

# 21. POC project structure

Since you're using Node/NestJS in your projects, I'd structure it something like:

```text
src/
│
├── payments/
│   ├── payments.module.ts
│   │
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   │
│   ├── razorpay/
│   │   ├── razorpay.service.ts
│   │   ├── razorpay.controller.ts
│   │   └── razorpay.webhook.ts
│   │
│   ├── dto/
│   │   ├── create-payment.dto.ts
│   │   └── verify-payment.dto.ts
│   │
│   └── entities/
│       └── payment.entity.ts
│
├── orders/
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── entities/
│       └── order.entity.ts
│
└── products/
```

Environment:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
```

---

# 22. Important security checklist

These are the things I'd specifically put in your POC checklist.

### Never do

```text
❌ Create Razorpay order from frontend
❌ Put Key Secret in frontend
❌ Trust amount from frontend
❌ Mark order PAID from frontend callback alone
❌ Fulfil order after only "payment successful" UI
❌ Ignore webhook signature
❌ Process duplicate webhook events
```

### Do

```text
✅ Calculate amount on backend
✅ Create Razorpay order on backend
✅ Store Razorpay order ID
✅ Verify payment signature server-side
✅ Verify webhook signature
✅ Enable auto capture
✅ Store payment ID
✅ Make payment ID unique
✅ Handle duplicate webhooks
✅ Handle failed payments
✅ Handle refunds
✅ Use HTTPS
✅ Keep secrets in environment/secret manager
```

These align with Razorpay's current integration/security guidance. ([Razorpay][2])

---

# 23. What happens if customer closes the browser?

This is a very important real-world scenario.

### Scenario

```text
Customer pays ₹2499
       ↓
Razorpay captures payment
       ↓
Customer closes browser
       ↓
Frontend never calls /verify
```

Without webhook:

```text
Your DB:
PENDING ❌
```

But money has actually been received.

With webhook:

```text
Razorpay
   |
   | payment.captured
   v
Your Backend
   |
   v
DB
   |
   v
PAID ✅
```

That's why **webhook support is not optional for a serious ecommerce integration**.

Razorpay explicitly recommends webhooks as the primary event-notification mechanism and API verification when immediate user-facing confirmation is needed. ([Razorpay][1])

---

# 24. What happens if payment succeeds but your API is down?

Another important scenario.

```text
Customer
   ↓
Razorpay
   ↓
₹2499 captured
   ↓
Your backend ❌ DOWN
```

Razorpay webhook delivery should allow your system to recover once your endpoint is available. Your webhook handler should therefore be **idempotent**.

This is why you shouldn't design the system around:

```text
Frontend callback → immediately mark order PAID
```

Instead:

```text
Frontend callback
       +
Razorpay webhook
       +
Payment API verification
       ↓
Reliable payment state
```

---

# 25. Razorpay vs alternatives

For an Indian ecommerce website, you have several choices.

| Gateway                     | Good for                      | Main consideration                                |
| --------------------------- | ----------------------------- | ------------------------------------------------- |
| **Razorpay**                | General Indian ecommerce      | Excellent ecosystem and developer experience      |
| **Cashfree Payments**       | Indian payments, payouts      | Strong payment/payout ecosystem                   |
| **PayU**                    | Large Indian businesses       | Mature enterprise payment ecosystem               |
| **Stripe**                  | International/global payments | Excellent developer experience, especially global |
| **CCAvenue**                | Indian merchants/enterprise   | Long-established Indian gateway                   |
| **PhonePe Payment Gateway** | India/UPI-heavy use cases     | Strong UPI ecosystem                              |

For your particular POC, I would shortlist:

```text
1. Razorpay
2. Cashfree
3. Stripe
4. PayU
```

But the right choice depends heavily on whether you're targeting **India only or international customers**, payment methods, settlement requirements, refunds, subscriptions, marketplace/split payments, and commercial pricing.

---

# 26. One thing I recommend architecturally

Even if you're only using Razorpay today, **don't tightly couple your Order service to Razorpay**.

Instead:

```text
             Payment Service
                    |
        +-----------+-----------+
        |           |           |
    Razorpay    Cashfree     Stripe
```

Your application should talk to:

```typescript
PaymentGateway
```

rather than directly everywhere:

```typescript
Razorpay
```

For example:

```typescript
interface PaymentGateway {
  createOrder(): Promise<PaymentOrder>;

  verifyPayment(): Promise<boolean>;

  getPaymentStatus(): Promise<PaymentStatus>;

  refundPayment(): Promise<Refund>;
}
```

Then:

```text
RazorpayGateway implements PaymentGateway
CashfreeGateway implements PaymentGateway
StripeGateway implements PaymentGateway
```

Your ecommerce application doesn't care which gateway is underneath.

This is especially useful if the business later says:

> "We need Stripe for international customers and Razorpay for India."

---

# 27. Recommended POC architecture

For your case, I'd implement:

```text
                 ┌──────────────────┐
                 │   Ecommerce UI   │
                 │ React / Next.js  │
                 └────────┬─────────┘
                          │
                          │ Checkout
                          ▼
                 ┌──────────────────┐
                 │   Order API      │
                 │                  │
                 │ Validate Cart    │
                 │ Calculate Amount │
                 │ Create Order     │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ Payment Service  │
                 └────────┬─────────┘
                          │
                          │ Create Order
                          ▼
                 ┌──────────────────┐
                 │    Razorpay      │
                 │                  │
                 │ Checkout         │
                 │ UPI              │
                 │ Cards            │
                 │ Net Banking      │
                 └────────┬─────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
           Browser Callback      Webhook
                │                   │
                ▼                   ▼
         ┌──────────────────────────────┐
         │       Your Backend           │
         │                              │
         │ Signature Verification       │
         │ Webhook Verification         │
         │ Payment Status               │
         │ Idempotency                  │
         └──────────────┬───────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  PostgreSQL  │
                 │              │
                 │ Orders       │
                 │ Payments     │
                 │ Refunds      │
                 └──────────────┘
```

---

# 28. POC task breakdown

I'd create Jira/tasks approximately like this:

### Razorpay Setup

* Create Razorpay Test Account
* Generate Test API Keys
* Configure webhook
* Configure test payment methods

### Backend

* Create Order entity
* Create Payment entity
* Create `POST /checkout/create-order`
* Integrate Razorpay Orders API
* Store Razorpay Order ID
* Implement payment verification
* Implement HMAC signature validation
* Implement webhook endpoint
* Implement webhook signature validation
* Implement idempotency
* Implement payment status handling

### Frontend

* Add Razorpay Checkout
* Create Pay Now button
* Handle payment success
* Handle payment failure
* Handle checkout cancellation
* Display payment status

### Testing

* Successful UPI payment
* Successful card payment
* Failed payment
* User closes checkout
* Duplicate webhook
* Invalid signature
* Incorrect amount
* Payment timeout
* Backend unavailable during callback
* Webhook retry
* Refund

### Production

* KYC
* Live API keys
* HTTPS
* Secret management
* Auto capture
* Webhooks
* Refund handling
* Monitoring/logging
* Reconciliation

---

## The most important takeaway

For your ecommerce POC, don't think of Razorpay as simply:

```text
"Add Razorpay button"
```

Think of it as a **payment lifecycle**:

```text
             YOUR SYSTEM
                 │
                 ▼
          Create Ecommerce Order
                 │
                 ▼
          Calculate final amount
                 │
                 ▼
        Create Razorpay Order
                 │
                 ▼
          Open Razorpay Checkout
                 │
                 ▼
             Customer pays
                 │
          ┌──────┴──────┐
          ▼             ▼
      Callback       Webhook
          │             │
          ▼             ▼
     Verification + Status
                 │
                 ▼
          Payment Captured
                 │
                 ▼
            Order PAID
                 │
                 ▼
             Fulfilment
```

Razorpay's official integration sequence is essentially **create server-side order → checkout → receive payment details → server-side signature verification → capture/status verification → webhooks → go live**. ([Razorpay][1])

For a **POC**, I would strongly recommend implementing **Razorpay only first**, and after that abstracting the payment layer so that Cashfree/Stripe/PayU can be plugged in without changing your ecommerce order flow.

If your stack is **React/Next.js + NestJS + PostgreSQL**, I can also give you the **complete POC implementation structure with DB tables, NestJS APIs, Razorpay integration code, React checkout code, webhook handling, and the exact end-to-end request/response sequence**.

[1]: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/?utm_source=chatgpt.com "Standard Checkout - Integration Steps | Razorpay Payment Gateway | Razorpay Docs"
[2]: https://razorpay.com/docs/developer-tools/integrations/standard-checkout/?utm_source=chatgpt.com "Standard Checkout Integration Guide | Razorpay | Razorpay Docs"
[3]: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/?preferred-country=IN&utm_source=chatgpt.com "Standard Checkout - Integration Steps | Razorpay Payment Gateway | Razorpay Docs"
