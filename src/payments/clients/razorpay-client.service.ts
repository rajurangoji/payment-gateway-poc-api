import { Injectable, Logger } from '@nestjs/common';
import Razorpay = require('razorpay');

import { RazorpayConfig } from '../../config/razorpay.config';

import { RazorpayApiError } from './razorpay-api.error';

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayRefundResult {
  id: string;
  status: string;
}

interface RazorpayCreateOrderPayload {
  amount: number;
  currency: string;
  receipt: string;
}

interface RazorpayCreateRefundPayload {
  amount: number;
}

@Injectable()
export class RazorpayClientService {
  private readonly logger = new Logger(RazorpayClientService.name);
  private readonly client: Razorpay;

  constructor(razorpayConfig: RazorpayConfig) {
    this.client = new Razorpay({
      key_id: razorpayConfig.keyId,
      key_secret: razorpayConfig.keySecret,
    });
  }

  async createOrder(
    amountPaise: number,
    currency: string,
    receipt: string,
  ): Promise<RazorpayOrderResult> {
    const payload: RazorpayCreateOrderPayload = {
      amount: amountPaise,
      currency,
      receipt,
    };
    this.logger.log(
      `POST /v1/orders payload: ${JSON.stringify(payload)}`,
    );

    try {
      const order = await this.client.orders.create(payload);
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
      };
    } catch (error) {
      throw new RazorpayApiError('Failed to create Razorpay order', error);
    }
  }

  async createRefund(
    paymentId: string,
    amountPaise: number,
  ): Promise<RazorpayRefundResult> {
    const payload: RazorpayCreateRefundPayload = { amount: amountPaise };
    this.logger.log(
      `POST /v1/payments/${paymentId}/refund payload: ${JSON.stringify(payload)}`,
    );

    try {
      const refund = await this.client.payments.refund(paymentId, payload);
      return { id: refund.id, status: refund.status };
    } catch (error) {
      throw new RazorpayApiError('Failed to create Razorpay refund', error);
    }
  }
}
