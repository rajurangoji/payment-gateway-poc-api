import * as crypto from 'crypto';

import {
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay-signature.util';

describe('verifyPaymentSignature', () => {
  const secret = 'test_key_secret';
  const orderId = 'order_abc123';
  const paymentId = 'pay_abc123';

  function sign(input: string): string {
    return crypto.createHmac('sha256', secret).update(input).digest('hex');
  }

  it('returns true when the signature matches HMAC_SHA256(orderId|paymentId, secret)', () => {
    const validSignature = sign(`${orderId}|${paymentId}`);

    expect(
      verifyPaymentSignature(orderId, paymentId, validSignature, secret),
    ).toBe(true);
  });

  it('returns false when the signature does not match', () => {
    expect(
      verifyPaymentSignature(
        orderId,
        paymentId,
        'not-a-real-signature',
        secret,
      ),
    ).toBe(false);
  });

  it('returns false (never throws) when the signature has a different length than expected', () => {
    expect(() =>
      verifyPaymentSignature(orderId, paymentId, 'short', secret),
    ).not.toThrow();
    expect(verifyPaymentSignature(orderId, paymentId, 'short', secret)).toBe(
      false,
    );
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'test_webhook_secret';
  const rawBody = '{"event":"payment.captured"}';

  function sign(input: string): string {
    return crypto.createHmac('sha256', secret).update(input).digest('hex');
  }

  it('returns true when the signature matches HMAC_SHA256(rawBody, secret)', () => {
    const validSignature = sign(rawBody);

    expect(verifyWebhookSignature(rawBody, validSignature, secret)).toBe(true);
  });

  it('returns false when the signature does not match', () => {
    expect(
      verifyWebhookSignature(rawBody, 'not-a-real-signature', secret),
    ).toBe(false);
  });

  it('returns false (never throws) for an empty signature', () => {
    expect(() => verifyWebhookSignature(rawBody, '', secret)).not.toThrow();
    expect(verifyWebhookSignature(rawBody, '', secret)).toBe(false);
  });
});
