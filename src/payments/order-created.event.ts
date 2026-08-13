import { IsIn, IsISO8601, IsNumber, IsString } from 'class-validator';

export class OrderCreatedEvent {
  @IsIn(['ORDER_CREATED'])
  type = 'ORDER_CREATED' as const;

  @IsString()
  orderId: string;

  @IsString()
  orderNumber: string;

  @IsString()
  userId: string;

  @IsString()
  razorpayOrderId: string;

  @IsNumber()
  totalAmount: number;

  @IsString()
  currency: string;

  @IsIn(['PENDING_PAYMENT'])
  status = 'PENDING_PAYMENT' as const;

  @IsISO8601()
  at: string;
}
