import { Injectable } from '@nestjs/common';
import Razorpay = require('razorpay');

import { RazorpayConfig } from '../config/razorpay.config';

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

@Injectable()
export class RazorpayClientService {
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
    try {
      const order = await this.client.orders.create({
        amount: amountPaise,
        currency,
        receipt,
      });
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
    try {
      const refund = await this.client.payments.refund(paymentId, {
        amount: amountPaise,
      });
      return { id: refund.id, status: refund.status };
    } catch (error) {
      throw new RazorpayApiError('Failed to create Razorpay refund', error);
    }
  }
}
