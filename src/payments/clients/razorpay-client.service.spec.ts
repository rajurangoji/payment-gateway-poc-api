import { RazorpayConfig } from '../../config/razorpay.config';

import { RazorpayApiError } from './razorpay-api.error';
import { RazorpayClientService } from './razorpay-client.service';

const createMock = jest.fn();
const refundMock = jest.fn();

jest.mock('razorpay', () => {
  class MockRazorpay {
    orders = { create: createMock };
    payments = { refund: refundMock };
  }
  return MockRazorpay;
});

describe('RazorpayClientService', () => {
  let service: RazorpayClientService;

  beforeEach(() => {
    createMock.mockReset();
    refundMock.mockReset();

    const config = new RazorpayConfig();
    config.keyId = 'rzp_test_dummy';
    config.keySecret = 'dummy_secret';

    service = new RazorpayClientService(config);
  });

  describe('createOrder', () => {
    it('calls orders.create with the amount, currency, and receipt and returns the order', async () => {
      createMock.mockResolvedValue({
        id: 'order_abc123',
        amount: 249900,
        currency: 'INR',
        status: 'created',
      });

      const result = await service.createOrder(249900, 'INR', 'ORD-1');

      expect(createMock).toHaveBeenCalledWith({
        amount: 249900,
        currency: 'INR',
        receipt: 'ORD-1',
      });
      expect(result).toEqual({
        id: 'order_abc123',
        amount: 249900,
        currency: 'INR',
        status: 'created',
      });
    });

    it('wraps SDK errors in a RazorpayApiError', async () => {
      createMock.mockRejectedValue(new Error('network down'));

      await expect(service.createOrder(249900, 'INR', 'ORD-1')).rejects.toThrow(
        RazorpayApiError,
      );
    });
  });

  describe('createRefund', () => {
    it('calls payments.refund with the paymentId and amount and returns the refund', async () => {
      refundMock.mockResolvedValue({ id: 'rfnd_abc123', status: 'processed' });

      const result = await service.createRefund('pay_abc123', 249900);

      expect(refundMock).toHaveBeenCalledWith('pay_abc123', { amount: 249900 });
      expect(result).toEqual({ id: 'rfnd_abc123', status: 'processed' });
    });

    it('wraps SDK errors in a RazorpayApiError', async () => {
      refundMock.mockRejectedValue(new Error('network down'));

      await expect(service.createRefund('pay_abc123', 249900)).rejects.toThrow(
        RazorpayApiError,
      );
    });
  });
});
