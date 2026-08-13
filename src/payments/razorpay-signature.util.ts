import * as crypto from 'crypto';

function safeCompare(
  expected: string,
  actual: string | undefined | null,
): boolean {
  if (!actual) {
    return false;
  }
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string | undefined | null,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeCompare(expected, signature);
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined | null,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return safeCompare(expected, signature);
}
